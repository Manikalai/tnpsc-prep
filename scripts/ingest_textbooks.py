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
import csv, io, json, os, re, sys, time, hashlib, pathlib, unicodedata
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

# Some SCERT fonts store the "prefix" vowel signs (ெ ே ை) BEFORE the consonant, in visual order.
# Correct Unicode never has one of these signs right after something that isn't a consonant, so
# "ெக" → "கெ" is safe; then ெ+ா → ொ, ே+ா → ோ, ெ+ௗ → ௌ.
PREFIX_SIGN = re.compile(r"(?<![க-ஹ])([ெேை])([க-ஹ](?:்ஷ)?)")

STRAY_LATIN = re.compile(r"(?<=[\u0B80-\u0BFF])[A-Z](?=[\u0B80-\u0BFF])")   # "பHொருட்கள்" → "பொருட்கள்"
DOUBLED = re.compile(r"([க-ஹ])\1(?![்])")                                     # "ககாரங்கள்" → "காரங்கள்", "மாறுகிறறது" → "மாறுகிறது"

def fix_order(t: str) -> str:
    t = STRAY_LATIN.sub("", t)
    t = PREFIX_SIGN.sub(r"\2\1", t)
    t = DOUBLED.sub(r"\1", t)
    return unicodedata.normalize("NFC", t)   # ெ+ா → ொ, ே+ா → ோ, ெ+ௗ → ௌ

OCR_MODE = (os.environ.get("OCR") or "auto").lower()   # "off": use the PDF's own text (fast, no OCR); "auto": OCR broken pages

def clean(t: str) -> str:
    t = fix_order(t)
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
        m = re.search(r"/d/([\w-]+)|[?&]id=([\w-]+)", source)
        gdown.download(id=(m.group(1) or m.group(2)) if m else None, url=None if m else source, output=str(p), quiet=True)
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

# ───────── real textbook pages as images (Supabase Storage bucket "pages", public) ─────────
PAGE_WIDTH = int(os.environ.get("PAGE_WIDTH") or 900)    # px; readable on phones (tap to zoom)

def book_key(title: str) -> str:
    return hashlib.sha1(title.encode("utf-8")).hexdigest()[:12]   # same as lib/book-pages.ts

def ensure_bucket():
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    r = requests.get(f"{URL}/storage/v1/bucket/pages", headers=h, timeout=60)
    if r.status_code == 200:
        return
    r = requests.post(f"{URL}/storage/v1/bucket", headers=h, timeout=60,
                      data=json.dumps({"id": "pages", "name": "pages", "public": True, "allowed_mime_types": ["image/webp"]}))
    if r.status_code >= 300 and "already exists" not in r.text.lower():
        raise SystemExit(f"could not create storage bucket 'pages': {r.status_code} {r.text[:200]}")

def page_webp(page) -> bytes:
    """Smaller of lossless WebP (best for text pages: sharp and tiny) and lossy WebP (best for photo pages)."""
    from PIL import Image
    zoom = PAGE_WIDTH / max(page.rect.width, 1)
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    best = None
    for kw in ({"lossless": True, "quality": 60, "method": 4}, {"quality": 55, "method": 4}):
        out = io.BytesIO()
        img.save(out, "WEBP", **kw)
        if best is None or out.tell() < len(best):
            best = out.getvalue()
    return best

def upload_pages(doc, title: str):
    """Render every page and upload it; returns (pages, MB)."""
    from concurrent.futures import ThreadPoolExecutor
    key = book_key(title)
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "image/webp", "x-upsert": "true", "cache-control": "max-age=31536000"}
    imgs = [(i + 1, page_webp(page)) for i, page in enumerate(doc)]
    def put(item):
        no, data = item
        for attempt in range(4):
            try:
                r = requests.post(f"{URL}/storage/v1/object/pages/{key}/{no}.webp", headers=h, data=data, timeout=120)
                if r.status_code < 300:
                    return True
            except Exception:
                pass
            time.sleep(3 * (attempt + 1))
        return False
    with ThreadPoolExecutor(max_workers=8) as ex:
        ok = sum(ex.map(put, imgs))
    if ok < len(imgs):
        raise RuntimeError(f"only {ok}/{len(imgs)} page images uploaded")
    return ok, sum(len(d) for _, d in imgs) / 1048576

def pages_done(title: str) -> bool:
    r = sb("GET", "job_runs", params={"job": "eq.pages_done", "detail->>book": f"eq.{title}", "select": "id", "limit": "1"})
    return len(r.json()) > 0

def do_pages(doc, title: str):
    if pages_done(title):
        print("  page images already uploaded")
        return
    n, mb = upload_pages(doc, title)
    sb("POST", "job_runs", data=json.dumps({"job": "pages_done", "ok": True, "detail": {"book": title, "pages": n, "mb": round(mb, 1)}}), headers={"Prefer": "return=minimal"})
    print(f"  page images: {n} pages, {mb:.0f} MB")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_only = "--check" in sys.argv
    pages_only = "--pages-only" in sys.argv          # only upload page images (books already loaded)
    only = os.environ.get("BOOK", "").strip()       # load just the books whose title contains this text
    manifest = args[0] if args else "textbooks/manifest.csv"
    if not check_only and not (URL and KEY and GEMINI):
        raise SystemExit("set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY")
    rows = [r for r in csv.DictReader(l for l in open(manifest, encoding="utf-8") if l.strip() and not l.startswith("#"))]
    if not rows:
        raise SystemExit("manifest has no books yet — add lines to textbooks/manifest.csv")
    if only:
        rows = [r for r in rows if only in r["title"]]
        if not rows:
            raise SystemExit(f"no book in the manifest matches '{only}'")
    if not check_only:
        ensure_bucket()
    total = 0
    failed = []
    for row in rows:
        title, subject, std = row["title"].strip(), row["subject"].strip(), int(row["std"])
        print(f"\n== {title}")
        loaded = not check_only and already_loaded(title)
        if pages_only and not loaded:
            print("  not loaded yet, skipping")
            continue
        if pages_only or loaded:
            if not check_only:
                if not pages_only:
                    print("  already loaded")
                try:
                    do_pages(fitz.open(get_pdf(row["source"].strip())), title)
                except Exception as e:
                    print(f"  !! page images failed: {e}")
                    failed.append(title)
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
            if OCR_MODE == "off":
                if len(text.strip()) >= 40:
                    pages.append((i + 1, clean(text)))
            elif page_ok(text, subject):
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
        want = [int(x) for x in (os.environ.get("SAMPLE_PAGES") or "").split(",") if x.strip().isdigit()]
        if want:   # print whole pages, to compare with the book
            for no, t in pages:
                if no in want:
                    print(f"\n  ---------- PDF page {no} ----------\n{t}\n")
        else:
            for _, t in pages[len(pages) // 4:: max(1, len(pages) // 4)][:3]:
                print(f"  sample (garble {garble_score(t):.1f}):", t[:220].replace("\n", " "))
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
        try:
            do_pages(doc, title)
        except Exception as e:
            print(f"  !! page images failed: {e}")
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
