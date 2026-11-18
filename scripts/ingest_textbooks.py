#!/usr/bin/env python3
"""Load Tamil-medium Samacheer textbooks into Supabase for question generation.

For each book in textbooks/manifest.csv:
  1. download (or open) the PDF
  2. extract text page by page; pages whose Tamil text looks broken (old font encodings) are OCR'd
     with Tesseract's Tamil model
  3. split into ~1200-character chunks that remember their page number
  4. embed with Gemini (768 dims) and insert into textbook_chunks

Books already loaded are skipped, so the job can be re-run safely.
Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_EMBED_MODEL (optional)
Usage: python scripts/ingest_textbooks.py [textbooks/manifest.csv] [--check]   (--check = extraction report only)
"""
import csv, io, json, os, re, sys, time, hashlib, pathlib
import requests
import fitz  # PyMuPDF

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI = os.environ.get("GEMINI_API_KEY", "")
EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL") or "gemini-embedding-001"
CACHE = pathlib.Path("textbooks/cache")
TAMIL = re.compile(r"[஀-௿]")
# characters typical of legacy Tamil fonts decoded as Latin-1 (e.g. TAB/TAM/Bamini) → text is unusable
LEGACY = re.compile(r"[À-ÿŒœ‘-„]{3,}")

def tamil_ratio(s: str) -> float:
    letters = [c for c in s if c.isalpha()]
    return (sum(1 for c in letters if TAMIL.match(c)) / len(letters)) if letters else 0.0

def page_ok(text: str, subject: str) -> bool:
    if len(text.strip()) < 40:
        return False
    if garble_score(text) > 4:   # SCERT PDFs with broken Tamil font mapping → OCR instead
        return False
    if LEGACY.search(text):
        return False
    # Tamil-medium books: most letters should be Tamil (maths pages have lots of digits, which are not letters)
    return tamil_ratio(text) >= 0.45

def ocr_png(png: bytes) -> str:
    import pytesseract
    from PIL import Image
    return pytesseract.image_to_string(Image.open(io.BytesIO(png)), lang="tam+eng")

def ocr_page(page) -> str:
    return ocr_png(page.get_pixmap(dpi=250).tobytes("png"))

VOWEL_SIGNS = "ா-்ௗ"
REPEAT_SIGN = re.compile("([" + VOWEL_SIGNS + "])(?:�)?\\1+")   # ொ�ொ, ்், ாா  -> one sign
FOOTER = re.compile(r"^.*(\.indd\b|\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}(:\d{2})?).*$", re.M)

def garble_score(t: str) -> float:
    """How broken the extracted Tamil looks: replacement chars and doubled vowel signs per 1000 chars."""
    if not t:
        return 0.0
    bad = t.count("�") + len(re.findall("[" + VOWEL_SIGNS + "]{2,}", t))
    return bad * 1000 / max(len(t), 1)

def clean(t: str) -> str:
    t = FOOTER.sub("", t)
    t = REPEAT_SIGN.sub(r"\1", t)
    t = t.replace("�", "").replace("­", "")
    t = re.sub("[\u200c\u200d]", "", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

def chunks_of(pages, size=1200, overlap=0):
    """pages: list of (page_no, text) → list of (page_from, page_to, text)"""
    out, buf, start = [], "", None
    for no, text in pages:
        for para in re.split(r"\n\s*\n", text):
            para = para.strip()
            if not para:
                continue
            if start is None:
                start = no
            if len(buf) + len(para) > size and buf:
                out.append((start, no, buf.strip()))
                buf = (buf[-overlap:] if overlap else "") + "\n" + para
                start = no
            else:
                buf += "\n" + para
    if buf.strip():
        out.append((start, pages[-1][0] if pages else start, buf.strip()))
    return [c for c in out if len(c[2]) > 120]

GEN_MODELS = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or "gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest,gemini-3.5-flash-lite,gemini-flash-lite-latest").split(",") if m.strip()]

TAMIL_NUM = {"ஒன்று": 1, "இரண்டு": 2, "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5, "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10}
HEADING = re.compile(r"^\s*(இயல்|அலகு|பாடம்|Unit|UNIT|Lesson)\s*[-–:.]?\s*(\d{1,2}|" + "|".join(TAMIL_NUM) + r")(?![஀-௿\w])\s*[-–:.]?\s*(.{0,80})", re.M)

def heading_chapters(pages, subject):
    """Fallback without AI: pages whose top lines start with இயல் / அலகு / பாடம் N."""
    found, seen = [], set()
    for no, t in pages:
        m = HEADING.search(t[:300])
        if not m:
            continue
        num = TAMIL_NUM.get(m.group(2)) or int(m.group(2)) if m.group(2).isdigit() or m.group(2) in TAMIL_NUM else None
        if not num or num in seen:
            continue
        seen.add(num)
        title = re.sub(r"\s+", " ", m.group(3)).strip(" -–:.") or f"{m.group(1)} {num}"
        found.append({"no": num, "title": title, "start_page": no, "subject": "social" if subject == "sciso" else subject})
    return found if len(found) >= 2 else []

def gemini_json(prompt: str):
    last = None
    for model in GEN_MODELS:
        for attempt in range(3):
            try:
                r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                  headers={"x-goog-api-key": GEMINI, "Content-Type": "application/json"},
                                  data=json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                                                   "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}), timeout=240)
                if r.status_code == 200:
                    txt = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
                    return json.loads(txt)
                last = f"{model} {r.status_code}: {r.text[:150]}"
            except Exception as e:
                last = f"{model}: {e}"
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(last)

def detect_chapters(pages, title, subject):
    """Return [(chapter_no, title_ta, subject, page_from, page_to)] using the first lines of every page."""
    index = "\n".join(f"[p{no}] " + re.sub(r"\s+", " ", t[:180]) for no, t in pages)
    allowed = "science or social" if subject == "sciso" else subject
    prompt = (
        f"This is the first text of every page of the Tamil Nadu Samacheer Kalvi textbook \"{title}\". "
        "Find where each lesson/chapter (பாடம் / அலகு / இயல்) begins. Ignore the contents page (பொருளடக்கம்), preface, "
        "and exercise/answer pages at the end. For each chapter give its number as printed, its Tamil title, the page number "
        f"[pN] where it starts, and its subject ({allowed}). If the book has several parts (e.g. Science then Social Science, "
        "or Tamil then English), number chapters within each subject and SKIP any English-language part. "
        'Return JSON {"chapters":[{"no":1,"title":"","start_page":5,"subject":"' + ("science" if subject == "sciso" else subject) + '"}]}\n\n' + index
    )
    try:
        data = gemini_json(prompt)
        chs = [c for c in data.get("chapters", []) if isinstance(c.get("start_page"), int) and c.get("title")]
    except Exception as e:
        print(f"  AI chapter detection failed ({str(e)[:120]}); trying lesson headings")
        chs = []
    if not chs:
        chs = heading_chapters(pages, subject)
        if chs:
            print(f"  found {len(chs)} lessons from headings")
        else:
            print("  no lesson headings found; using the whole book as one chapter")
    last_page = pages[-1][0] if pages else 1
    if not chs:
        return [(1, title, "social" if subject == "sciso" else subject, pages[0][0] if pages else 1, last_page)]
    chs.sort(key=lambda c: c["start_page"])
    out, seen = [], set()
    for i, c in enumerate(chs):
        subj = c.get("subject") if subject == "sciso" else subject
        if subj not in ("tamil", "social", "science"):
            subj = "social" if subject == "sciso" else subject
        end = (chs[i + 1]["start_page"] - 1) if i + 1 < len(chs) else last_page
        no = int(c.get("no") or i + 1)
        while (subj, no) in seen:  # keep (subject, chapter_no) unique
            no += 100
        seen.add((subj, no))
        out.append((no, str(c["title"]).strip()[:200], subj, c["start_page"], max(end, c["start_page"])))
    return out

class EmbedQuota(Exception):
    pass

NO_EMBED = {"on": os.environ.get("SKIP_EMBEDDINGS") == "1"}

def embed(texts):
    """Gemini embeddings; returns None for every text if the free quota is used up (passages are still stored)."""
    if NO_EMBED["on"]:
        return [None] * len(texts)
    try:
        return _embed(texts)
    except EmbedQuota:
        NO_EMBED["on"] = True
        print("    embedding quota reached — storing passages without embeddings (keyword + lesson search is used instead)")
        return [None] * len(texts)

def _embed(texts):
    vecs = []
    for i in range(0, len(texts), 50):
        batch = texts[i:i + 50]
        body = {"requests": [{"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": t}]},
                              "taskType": "RETRIEVAL_DOCUMENT", "outputDimensionality": 768} for t in batch]}
        for attempt in range(6):
            r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:batchEmbedContents",
                              headers={"x-goog-api-key": GEMINI, "Content-Type": "application/json"}, data=json.dumps(body), timeout=120)
            if r.status_code == 200:
                vecs += [e["values"] for e in r.json()["embeddings"]]
                break
            if r.status_code == 429 and ("quota" in r.text.lower() or attempt >= 1):
                raise EmbedQuota()
            wait = 20 * (attempt + 1)
            print(f"    embed {r.status_code}, waiting {wait}s: {r.text[:150]}")
            time.sleep(wait)
        else:
            raise EmbedQuota()
        time.sleep(1.5)
    return vecs

def sb(method, path, **kw):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    h.update(kw.pop("headers", {}))
    r = requests.request(method, f"{URL}/rest/v1/{path}", headers=h, timeout=120, **kw)
    if r.status_code >= 300:
        raise SystemExit(f"supabase {r.status_code}: {r.text[:300]}")
    return r

def already_loaded(title: str) -> bool:
    r = sb("GET", "job_runs", params={"job": "eq.book_done", "detail->>book": f"eq.{title}", "select": "id", "limit": "1"})
    return len(r.json()) > 0

def remove_partial(title: str):
    sb("DELETE", "chapters", params={"book": f"eq.{title}"})          # cascades to its passages
    sb("DELETE", "textbook_chunks", params={"book": f"eq.{title}"})

def get_pdf(source: str) -> pathlib.Path:
    if not source.startswith("http"):
        return pathlib.Path(source)
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / (hashlib.sha1(source.encode()).hexdigest()[:16] + ".pdf")
    if not p.exists() and "drive.google.com" in source:
        import gdown  # handles Google Drive's "large file" confirmation page
        print(f"  downloading from Google Drive {source}")
        gdown.download(url=source, output=str(p), quiet=True, fuzzy=True)
        if not p.exists() or p.stat().st_size < 10000:
            raise RuntimeError("Google Drive download failed (file not shared publicly?)")
    if not p.exists():
        print(f"  downloading {source}")
        with requests.get(source, stream=True, timeout=300, headers={"User-Agent": "Mozilla/5.0"}) as r:
            r.raise_for_status()
            with open(p, "wb") as f:
                for part in r.iter_content(1 << 20):
                    f.write(part)
    return p

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_only = "--check" in sys.argv
    manifest = args[0] if args else "textbooks/manifest.csv"
    if not check_only and not (URL and KEY and GEMINI):
        raise SystemExit("set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY")
    rows = [r for r in csv.DictReader(l for l in open(manifest, encoding="utf-8") if l.strip() and not l.startswith("#"))]
    if not rows:
        raise SystemExit("manifest has no books yet — add lines to textbooks/manifest.csv")
    total = 0
    failed = []
    for row in rows:
        title, subject, std = row["title"].strip(), row["subject"].strip(), int(row["std"])
        print(f"\n== {title}")
        if not check_only and already_loaded(title):
            print("  already loaded, skipping")
            continue
        if not check_only:
            remove_partial(title)
        try:
            doc = fitz.open(get_pdf(row["source"].strip()))
        except Exception as e:
            print(f"  !! could not download/open: {e}")
            failed.append(title)
            continue
        pages, ocr_n, need = [], 0, []
        for i, page in enumerate(doc):
            text = page.get_text("text")
            if page_ok(text, subject):
                pages.append((i + 1, clean(text)))
            else:
                need.append((i + 1, page.get_pixmap(dpi=250).tobytes("png")))
        if need:
            try:
                from concurrent.futures import ProcessPoolExecutor
                with ProcessPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
                    for (no, _), text in zip(need, ex.map(ocr_png, [png for _, png in need])):
                        pages.append((no, clean(text)))
                        ocr_n += 1
            except Exception as e:  # tesseract missing locally
                print(f"  OCR unavailable ({e}); {len(need)} pages skipped")
        pages.sort(key=lambda x: x[0])
        pages = [(no, t) for no, t in pages if t.strip()]
        chapters = detect_chapters(pages, title, subject) if pages else []
        print(f"  pages {len(doc)}, OCR {ocr_n}, chapters {len(chapters)}")
        for no, ctitle, subj, a, b in chapters:
            print(f"    {subj} {no}. {ctitle} (p{a}–{b})")
        sample = [t for _, t in pages[len(pages) // 2: len(pages) // 2 + 1]]
        if sample:
            print("  sample:", sample[0][:200].replace("\n", " "))
        if check_only or not chapters:
            continue
        stored = 0
        for no, ctitle, subj, a, b in chapters:
            ch = sb("POST", "chapters", params={"on_conflict": "book,subject,chapter_no"},
                    data=json.dumps({"book": title, "std": std, "term": row.get("term") or None, "subject": subj, "chapter_no": no,
                                     "title_ta": ctitle, "page_from": a, "page_to": b, "source_url": row["source"].strip() if row["source"].strip().startswith("http") else None}),
                    headers={"Prefer": "resolution=merge-duplicates,return=representation"}).json()[0]
            chunks = chunks_of([(n, t) for n, t in pages if a <= n <= b])
            if not chunks:
                continue
            vecs = embed([f"{ctitle}\n{c[2]}" for c in chunks])
            recs = [{"book": title, "std": std, "subject": subj, "term": row.get("term") or None, "page_from": pa, "page_to": pb,
                     "content": t, "quality": "text", "chapter_id": ch["id"], "embedding": ("[" + ",".join(f"{x:.6f}" for x in v) + "]") if v else None}
                    for (pa, pb, t), v in zip(chunks, vecs)]
            for i in range(0, len(recs), 100):
                sb("POST", "textbook_chunks", data=json.dumps(recs[i:i + 100]), headers={"Prefer": "return=minimal"})
            stored += len(recs)
        total += stored
        sb("POST", "job_runs", data=json.dumps({"job": "book_done", "ok": True, "detail": {"book": title, "chapters": len(chapters), "passages": stored, "ocr_pages": ocr_n}}), headers={"Prefer": "return=minimal"})
        print(f"  stored {stored} passages in {len(chapters)} chapters")
    if not check_only:
        sb("POST", "job_runs", data=json.dumps({"job": "ingest_textbooks", "ok": True, "detail": {"chunks": total}}), headers={"Prefer": "return=minimal"})
    print(f"\ndone, {total} chunks stored")
    if failed:
        print("\nBOOKS THAT FAILED (fix their links in textbooks/manifest.csv):")
        for t in failed:
            print("  -", t)

if __name__ == "__main__":
    main()
