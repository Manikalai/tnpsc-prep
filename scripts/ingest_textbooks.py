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

def chunks_of(pages, size=1200, overlap=150):
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
                buf = buf[-overlap:] + "\n" + para
                start = no
            else:
                buf += "\n" + para
    if buf.strip():
        out.append((start, pages[-1][0] if pages else start, buf.strip()))
    return [c for c in out if len(c[2]) > 120]

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
    for row in rows:
        title, subject, std = row["title"].strip(), row["subject"].strip(), int(row["std"])
        print(f"\n== {title}")
        if not check_only and already_loaded(title):
            print("  already loaded, skipping")
            continue
        doc = fitz.open(get_pdf(row["source"].strip()))
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
        chunks = chunks_of(pages)
        print(f"  pages {len(doc)}, OCR {ocr_n}, chunks {len(chunks)}")
        if chunks:
            print("  sample:", chunks[len(chunks) // 2][2][:200].replace("\n", " "))
        if check_only or not chunks:
            continue
        vecs = embed([c[2] for c in chunks])
        recs = [{"book": title, "std": std, "subject": subject, "term": row.get("term") or None, "page_from": a, "page_to": b,
                 "content": t, "quality": "text", "embedding": "[" + ",".join(f"{x:.6f}" for x in v) + "]"}
                for (a, b, t), v in zip(chunks, vecs)]
        for i in range(0, len(recs), 100):
            sb("POST", "textbook_chunks", data=json.dumps(recs[i:i + 100]), headers={"Prefer": "return=minimal"})
        total += len(recs)
        print(f"  stored {len(recs)} chunks")
    if not check_only:
        sb("POST", "job_runs", data=json.dumps({"job": "ingest_textbooks", "ok": True, "detail": {"chunks": total}}), headers={"Prefer": "return=minimal"})
    print(f"\ndone, {total} chunks stored")

if __name__ == "__main__":
    main()
