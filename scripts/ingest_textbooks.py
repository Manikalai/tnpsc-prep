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
    if LEGACY.search(text):
        return False
    # Tamil-medium books: most letters should be Tamil (maths pages have lots of digits, which are not letters)
    return tamil_ratio(text) >= 0.45

def ocr_page(page) -> str:
    import pytesseract
    from PIL import Image
    pix = page.get_pixmap(dpi=300)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(img, lang="tam+eng")

def clean(t: str) -> str:
    t = t.replace("­", "")
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

GEN_MODELS = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or "gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash").split(",") if m.strip()]

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
        print(f"  chapter detection failed ({e}); using the whole book as one chapter")
        chs = []
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

def embed(texts):
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
            wait = 20 * (attempt + 1)
            print(f"    embed {r.status_code}, waiting {wait}s: {r.text[:150]}")
            time.sleep(wait)
        else:
            raise SystemExit("embedding failed repeatedly (daily free limit reached?) — re-run later; finished books are kept")
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
    r = sb("GET", "textbook_chunks", params={"book": f"eq.{title}", "select": "id", "limit": "1"})
    return len(r.json()) > 0

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
        try:
            doc = fitz.open(get_pdf(row["source"].strip()))
        except Exception as e:
            print(f"  !! could not download/open: {e}")
            failed.append(title)
            continue
        pages, ocr_n = [], 0
        for i, page in enumerate(doc):
            text = page.get_text("text")
            if not page_ok(text, subject):
                try:
                    text = ocr_page(page)
                    ocr_n += 1
                except Exception as e:  # tesseract missing locally
                    print(f"  page {i + 1}: OCR unavailable ({e}); skipped")
                    continue
            pages.append((i + 1, clean(text)))
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
                     "content": t, "quality": "text", "chapter_id": ch["id"], "embedding": "[" + ",".join(f"{x:.6f}" for x in v) + "]"}
                    for (pa, pb, t), v in zip(chunks, vecs)]
            for i in range(0, len(recs), 100):
                sb("POST", "textbook_chunks", data=json.dumps(recs[i:i + 100]), headers={"Prefer": "return=minimal"})
            stored += len(recs)
        total += stored
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
