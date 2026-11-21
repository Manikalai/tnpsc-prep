#!/usr/bin/env python3
"""Import a TNPSC previous-year question paper with its official answer key.

  1. Download the question paper PDF and the answer-key PDF (TNPSC's scanned booklet with the correct
     option ticked).
  2. Questions: Gemini reads each question-paper page (image + its text layer) and returns every question
     number with the Tamil question and its four options.
  3. Answers: Gemini looks at each scanned answer-key page and reports which option is ticked for each
     question number, with its confidence. Cancelled questions are noted.
  4. Checks: totals must add up; the AI also solves each question independently and any disagreement with
     the tick is FLAGGED for a person to check (the tick always decides; the AI never overrides TNPSC).
  5. Preview mode prints a report and saves pyq_report.json (nothing stored). Import mode stores the questions.

Usage: python scripts/import_pyq.py QUESTION_PDF_URL KEY_PDF_URL --exam G4 --year 2025 [--import]
Env: GEMINI_API_KEY, GEMINI_MODELS (optional), and for --import: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import argparse, base64, hashlib, io, json, os, re, sys, time, pathlib
import requests
import fitz  # PyMuPDF

GEMINI = os.environ.get("GEMINI_API_KEY", "")
GEMINI_KEYS = [k.strip() for k in (os.environ.get("GEMINI_API_KEY", ""), os.environ.get("GEMINI_API_KEY_2", ""), os.environ.get("GEMINI_API_KEY_3", "")) if k.strip()]
MODELS = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or "gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash").split(",") if m.strip()]
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
L = ["A", "B", "C", "D"]
UNITS = {
    "G4": {"G4-TAMIL-1": "இலக்கணம்", "G4-TAMIL-2": "சொல்லகராதி", "G4-TAMIL-3": "எழுதும் திறன்", "G4-TAMIL-4": "கலைச் சொற்கள்",
           "G4-TAMIL-5": "வாசித்தல் – புரிந்து கொள்ளும் திறன்", "G4-TAMIL-6": "எளிய மொழிபெயர்ப்பு", "G4-TAMIL-7": "இலக்கியம், தமிழ் அறிஞர்கள், தமிழ்த்தொண்டு",
           "G4-GS-1": "பொது அறிவியல்", "G4-GS-2": "புவியியல்", "G4-GS-3": "இந்திய வரலாறு, பண்பாடு, தேசிய இயக்கம்", "G4-GS-4": "இந்திய ஆட்சியியல்",
           "G4-GS-5": "இந்தியப் பொருளாதாரம், TN வளர்ச்சி நிர்வாகம்", "G4-GS-6": "தமிழ்நாட்டின் வரலாறு, பண்பாடு, சமூக–அரசியல் இயக்கங்கள்",
           "G4-APT-1": "திறனறிவு (கணக்கு)", "G4-APT-2": "காரணவியல்"},
    "G2": {**{f"G2-TAMIL-{k}": v for k, v in {"A": "இலக்கணம்", "B": "இலக்கியம்", "C": "தமிழ் அறிஞர்கள்"}.items()},
           **{f"G2-GS-{i}": n for i, n in enumerate(["பொது அறிவியல்", "நடப்பு நிகழ்வுகள்", "புவியியல்", "வரலாறு, பண்பாடு", "ஆட்சியியல்", "பொருளாதாரம்", "தேசிய இயக்கம்", "TN வரலாறு, இயக்கங்கள்", "TN வளர்ச்சி நிர்வாகம்"], 1)},
           "G2-APT-1": "திறனறிவு", "G2-APT-2": "காரணவியல்"},
    "G1": {**{f"G1-GS-{i}": n for i, n in enumerate(["பொது அறிவியல்", "புவியியல்", "வரலாறு, தேசிய இயக்கம்", "ஆட்சியியல்", "பொருளாதாரம், TN வளர்ச்சி நிர்வாகம்", "TN வரலாறு, இயக்கங்கள்"], 1)},
           "G1-APT-1": "திறனறிவு", "G1-APT-2": "காரணவியல்"},
}
# the 10 aptitude topics of the app (lib/aptitude-topics.ts) — real questions are tagged style = "apt:<key>"
APT_TOPICS = {"simplification": "simplification, BODMAS, fractions, square roots", "percentage": "percentage, profit and loss",
              "hcf-lcm": "HCF and LCM", "ratio": "ratio and proportion, averages, ages, partnership", "interest": "simple and compound interest",
              "area-volume": "area, perimeter, volume, surface area", "time-work": "time and work, pipes, speed-distance, trains",
              "logical": "direction, calendar, clock, coding-decoding, blood relations", "puzzles-dice": "puzzles, seating, ranking, dice",
              "visual-series": "number series, letter series, odd one out, visual/figure reasoning, alpha-numeric"}
EXAM_NAME = {"G4": "தொகுதி IV", "G2": "தொகுதி II / IIA", "G1": "தொகுதி I"}


GROQ = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL") or "openai/gpt-oss-120b"
DEAD = set()          # models whose daily quota is used up — not tried again in this run
STARTED = time.time()
BUDGET = float(os.environ.get("TIME_BUDGET_MIN") or 70) * 60   # stop cleanly before GitHub cancels the job


class OutOfTime(Exception):
    pass


GROQ_MODELS = [m.strip() for m in (os.environ.get("GROQ_MODELS") or f"{GROQ_MODEL},qwen/qwen3.8-27b,openai/gpt-oss-20b").split(",") if m.strip()]


TOKENS = [0]


def _groq(text, temperature):
    """Groq (free): tries each model; waits on per-minute limits."""
    last = None
    for model in GROQ_MODELS:
        for attempt in range(4):
            r = requests.post("https://api.groq.com/openai/v1/chat/completions",
                              headers={"Authorization": f"Bearer {GROQ}", "Content-Type": "application/json"},
                              data=json.dumps({"model": model, "temperature": temperature, "response_format": {"type": "json_object"},
                                               "max_tokens": 8000,
                                               "messages": [{"role": "user", "content": text + "\nReply with JSON only."}]}),
                              timeout=180)
            if r.status_code == 200:
                try:
                    u = r.json().get("usage", {})
                    TOKENS[0] += u.get("total_tokens", 0)
                    return json.loads(r.json()["choices"][0]["message"]["content"])
                except Exception as e:
                    last = f"groq {model}: bad JSON {e}"
                    break
            last = f"groq {model} {r.status_code}: {r.text[:150]}"
            if r.status_code == 429 and "per day" not in r.text.lower():
                time.sleep(min(60, 15 * (attempt + 1)))
                continue
            break
    raise RuntimeError(last)


def gemini(parts, temperature=0.0):
    """Gemini (models in turn); text-only calls fall back to Groq. Gives up fast on used-up daily quota."""
    if time.time() - STARTED > BUDGET:
        raise OutOfTime()
    last = None
    for ki, key in enumerate(GEMINI_KEYS):
      for model in MODELS:
        if (ki, model) in DEAD:
            continue
        for attempt in range(3):
            try:
                r = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                    data=json.dumps({"contents": [{"role": "user", "parts": parts}],
                                     "generationConfig": {"responseMimeType": "application/json", "temperature": temperature}}),
                    timeout=150)
                if r.status_code == 200:
                    return json.loads("".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"]))
                last = f"key{ki + 1} {model} {r.status_code}: {r.text[:150]}"
                if r.status_code == 404 or (r.status_code == 429 and "PerDay" in r.text):
                    print(f"    key{ki + 1} {model}: {'not available' if r.status_code == 404 else 'daily quota used up'} — skipping it")
                    DEAD.add((ki, model))
                    break
                if r.status_code == 400:
                    break
            except Exception as e:
                last = f"key{ki + 1} {model}: {e}"
            time.sleep(10 * (attempt + 1))
    texts = [p["text"] for p in parts if "text" in p]
    if GROQ and len(texts) == len(parts):
        try:
            return _groq("\n".join(texts), temperature)
        except Exception as e:
            last = f"{last} | {e}"
    raise RuntimeError(last)


# ---------- Sarvam (Indian-language document reader + chat), used when READER=sarvam ----------
READER = os.environ.get("READER", "gemini").lower()
SARVAM = os.environ.get("SARVAM_API_KEY", "")
SPENT = {"pages": 0, "in": 0, "out": 0}


def _json(text):
    t = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    i, j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j + 1] if i >= 0 and j > i else t)


def sarvam_chat(prompt, temperature=0.0, max_tokens=4096):
    if time.time() - STARTED > BUDGET:
        raise OutOfTime()
    last = None
    for attempt in range(4):
        try:
            r = requests.post("https://api.sarvam.ai/v1/chat/completions",
                              headers={"Authorization": f"Bearer {SARVAM}", "Content-Type": "application/json"},
                              data=json.dumps({"model": os.environ.get("SARVAM_MODEL") or "sarvam-105b", "temperature": temperature,
                                               "max_tokens": max_tokens, "reasoning_effort": None,
                                               "response_format": {"type": "json_object"},
                                               "messages": [{"role": "user", "content": prompt}]}), timeout=300)
            if r.status_code == 200:
                j = r.json(); u = j.get("usage") or {}
                SPENT["in"] += u.get("prompt_tokens", 0); SPENT["out"] += u.get("completion_tokens", 0)
                return _json(j["choices"][0]["message"]["content"])
            last = f"sarvam {r.status_code}: {r.text[:200]}"
            if r.status_code in (401, 402, 403):
                break
        except Exception as e:
            last = f"sarvam: {e}"
        time.sleep(8 * (attempt + 1))
    raise RuntimeError(last)


def sarvam_parse(doc, pages, tag):
    """Markdown text of the given page indexes, read by Sarvam Document AI (Tamil)."""
    from sarvamai import SarvamAI
    import zipfile, tempfile
    sub = fitz.open()
    for i in pages:
        sub.insert_pdf(doc, from_page=i, to_page=i)
    f = pathlib.Path(tempfile.mkdtemp()) / f"{tag}.pdf"
    sub.save(f)
    client = SarvamAI(api_subscription_key=SARVAM)
    with open(f, "rb") as fh:
        job = client.doc_ai.parse(file=[(f.name, fh, "application/pdf")], language=os.environ.get("PARSE_LANG", "ta-IN"), content_type="printed")
    for _ in range(180):
        st = client.doc_ai.get_status(job_id=job.job_id)
        state = str(st.status).lower()
        if state in ("completed", "partially_completed"):
            break
        if state in ("failed", "rejected"):
            raise RuntimeError(f"sarvam parse {tag}: {state} {st.progress or ''}")
        time.sleep(5)
    else:
        raise RuntimeError(f"sarvam parse {tag}: timed out")
    dl = client.doc_ai.get_download_url(job_id=job.job_id)
    r = requests.request(dl.method or "GET", dl.url, headers=dl.headers or {}, timeout=300)
    r.raise_for_status()
    SPENT["pages"] += len(pages)
    data = r.content
    files = {}
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            files = {n: zf.read(n).decode("utf-8", "ignore") for n in sorted(zf.namelist()) if not n.endswith("/")}
    else:
        files = {"out": data.decode("utf-8", "ignore")}
    if os.environ.get("SHOW_PARSE") and SPENT["pages"] <= 3:
        print("  parse output files:", list(files)[:10])
    md = [v for n, v in files.items() if n.endswith(".md")]
    if md:
        return "\n\n".join(md)
    html = [v for n, v in files.items() if n.endswith((".html", ".htm"))]
    if html:
        t = "\n\n".join(html)
        t = re.sub(r"<(br|/p|/div|/tr|/li|/h\d)[^>]*>", "\n", t)
        t = re.sub(r"<[^>]+>", " ", t)
        return re.sub(r"[ \t]+", " ", t)
    return "\n\n".join(files.values())


def read_questions_sarvam(doc):
    """Sarvam reads 2 pages at a time (parallel jobs); Sarvam chat turns each piece into questions."""
    from concurrent.futures import ThreadPoolExecutor
    rng = os.environ.get("PAGES", "")
    lo, hi = (int(x) for x in rng.split("-")) if rng else (1, len(doc))
    idx = [i for i in range(len(doc)) if lo <= i + 1 <= hi]
    groups = [idx[b:b + 2] for b in range(0, len(idx), 2)]

    def parse(g):
        for attempt in range(3):
            try:
                return sarvam_parse(doc, g, f"p{g[0] + 1}")
            except Exception as e:
                print(f"  parse pages {g[0] + 1}–{g[-1] + 1}: {str(e)[:160]}")
                time.sleep(10)
        return ""
    with ThreadPoolExecutor(6) as ex:
        texts = list(ex.map(parse, groups))
    print(f"  Sarvam read {SPENT['pages']} pages")
    out = {}
    for k, (g, md) in enumerate(zip(groups, texts)):
        if not md.strip():
            continue
        nxt = texts[k + 1][:1500] if k + 1 < len(texts) else ""
        prompt = ("Below is the text of pages %s of a TNPSC question paper (may be bilingual Tamil/English), then the start of the next page. "
                  "Extract EVERY question that STARTS in the main text. For each: its printed number, the question in TAMIL exactly as printed "
                  "(letter for letter — spelling matters, these may be grammar/error questions) and its four options (A)(B)(C)(D) in TAMIL exactly as printed "
                  "(complete them from the next-page text if they continue there). Ignore option (E) 'விடை தெரியவில்லை'. If a question exists only in English, "
                  "give it as printed. Keep match-the-following lists and statements inside the question, one per line; copy match codes exactly. Skip instructions. "
                  "Do not correct or invent anything.\n"
                  'Return JSON {"questions":[{"no":1,"stem":"","options":["","","",""]}]}\n\n=== MAIN TEXT ===\n%s\n\n=== START OF NEXT PAGE ===\n%s') % (
                  f"{g[0] + 1}–{g[-1] + 1}", md[:14000], nxt)
        try:
            data = sarvam_chat(prompt, max_tokens=int(os.environ.get("SARVAM_MAX_TOKENS") or 8000))
        except OutOfTime:
            raise
        except Exception as e:
            print(f"  pages {g[0] + 1}–{g[-1] + 1}: structuring failed ({str(e)[:160]})")
            continue
        for q in (data.get("questions", []) if isinstance(data, dict) else []):
            if not isinstance(q, dict):
                continue
            no = q.get("no")
            if isinstance(no, str) and no.strip().isdigit():
                no = int(no.strip())
            if isinstance(no, int) and len(q.get("options", [])) == 4 and q.get("stem") and no not in out and all(str(o).strip() for o in q["options"]):
                out[no] = {"stem": str(q["stem"]).strip(), "options": [re.sub(r"^\s*\(?[A-Dஅஆஇஈ]\)\s*", "", str(o)).strip() for o in q["options"]]}
        print(f"  pages {g[0] + 1}–{g[-1] + 1}/{len(doc)}: total {len(out)}")
    return out


def read_key_sarvam(doc):
    """Answer-key table pages: Sarvam reads each page, Sarvam chat lists number → letter for the wanted subject."""
    out = {}
    want = os.environ.get("KEY_SUBJECT", "TAMIL").upper()
    for i in range(len(doc)):
        try:
            md = sarvam_parse(doc, [i], f"k{i + 1}")
            data = sarvam_chat("This is the text of one page of a TNPSC final answer key (a table of question numbers and answer letters A/B/C/D; "
                               "it may hold more than one subject/paper). Give the subject/paper name printed for this page and EVERY question number with its answer. "
                               "Deleted / cancelled / 'all correct' questions: answer null with a note. If the page holds two subjects, return only the part for subject containing "
                               f"'{want}' (if given).\n" 'Return JSON {"subject":"","answers":[{"no":1,"answer":"A","note":""}]}\n\n' + md[:14000],
                               max_tokens=8000)
        except OutOfTime:
            raise
        except Exception as e:
            print(f"  key page {i + 1}: failed ({str(e)[:160]})")
            continue
        subj = str(data.get("subject") or "").upper()
        if subj and want and want not in subj:
            print(f"  key page {i + 1}: '{subj}' — not this paper, skipped")
            continue
        for a in data.get("answers", []):
            no = a.get("no")
            if isinstance(no, str) and no.strip().isdigit():
                no = int(no.strip())
            if not isinstance(no, int):
                continue
            ans = str(a.get("answer") or "").strip().upper()[:1]
            idx = L.index(ans) if ans in L else None
            if no not in out or (out[no]["answer"] is None and idx is not None):
                out[no] = {"answer": idx, "confidence": "high", "note": a.get("note", "") or ""}
        print(f"  key page {i + 1}/{len(doc)}: total {len(out)}")
    return out


def img_part(page, dpi):
    png = page.get_pixmap(dpi=dpi).tobytes("png")
    return {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(png).decode()}}


def download(url, name):
    p = pathlib.Path("pyq_cache") / name
    p.parent.mkdir(exist_ok=True)
    if not p.exists():
        r = requests.get(url, timeout=300, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        p.write_bytes(r.content)
    return fitz.open(p)


def ocr(page):
    """Free Tamil+English OCR (Tesseract) for scanned pages."""
    import subprocess, tempfile
    f = tempfile.mktemp(suffix=".png")
    page.get_pixmap(dpi=300).save(f)
    cmd = ["tesseract", f, "-", "-l", os.environ.get("OCR_LANG", "tam"), "--psm", "4"]
    if os.environ.get("TESSDATA_BEST"):
        cmd += ["--tessdata-dir", os.environ["TESSDATA_BEST"]]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    os.remove(f)
    return out


def read_questions(doc):
    if READER == "sarvam":
        return read_questions_sarvam(doc)
    """{no: {stem, options}} from the question paper. Pages are read as images by Gemini (exact Tamil spelling matters
    for grammar questions, so no OCR), several pages per request to fit the free daily quota."""
    out = {}
    per = int(os.environ.get("PAGES_PER_CALL", "3"))
    rng = os.environ.get("PAGES", "")
    lo, hi = (int(x) for x in rng.split("-")) if rng else (1, len(doc))
    idx = [i for i in range(len(doc)) if lo <= i + 1 <= hi]
    for b in range(0, len(idx), per):
        group = idx[b:b + per]
        layers = "\n\n".join(f"--- page {i + 1} ---\n" + re.sub(r"\s+", " ", doc[i].get_text("text"))[:5000] for i in group)
        prompt = ("These are pages %s of a TNPSC question paper (it may be bilingual Tamil/English). Extract EVERY complete question on these pages. "
                  "For each: its printed number, the question in TAMIL exactly as printed (letter for letter — spelling matters, these may be grammar/error questions), "
                  "and its four options (A)(B)(C)(D) in TAMIL exactly as printed. Ignore option (E) 'விடை தெரியவில்லை'. "
                  "If a question exists only in English (e.g. an English-language section) give it as printed. Keep match-the-following lists and "
                  "statements inside the question text, one per line; copy match codes exactly. Skip instructions and questions cut off at the edge of the last page. "
                  "If a page has a text layer it is given below; use it where it is correct, but trust the images.\n"
                  'Return JSON {"questions":[{"no":1,"stem":"","options":["","","",""]}]}\n\nTEXT LAYER:\n') % ", ".join(str(i + 1) for i in group) + layers
        try:
            data = gemini([*(img_part(doc[i], 160) for i in group), {"text": prompt}])
        except OutOfTime:
            raise
        except Exception as e:
            print(f"  pages {group[0] + 1}–{group[-1] + 1}: failed ({str(e)[:160]})")
            if "quota" in str(e).lower() or "429" in str(e):
                raise SystemExit("Gemini daily limit reached while reading questions — the next daily run continues")
            continue
        if isinstance(data, list):
            data = {"questions": data}
        for q in data.get("questions", []) if isinstance(data, dict) else []:
            if not isinstance(q, dict):
                continue
            no = q.get("no")
            if isinstance(no, str) and no.strip().isdigit():
                no = int(no.strip())
            if isinstance(no, int) and len(q.get("options", [])) == 4 and q.get("stem") and no not in out and all(str(o).strip() for o in q["options"]):
                out[no] = {"stem": q["stem"].strip(), "options": [str(o).strip() for o in q["options"]]}
        print(f"  pages {group[0] + 1}–{group[-1] + 1}/{len(doc)}: total {len(out)}")
        time.sleep(4)
    return out


def read_key(doc):
    """{no: {answer, confidence, cancelled}} from the scanned answer-key booklet (ticks)."""
    if READER == "sarvam":
        return read_key_sarvam(doc)
    out = {}
    for i, page in enumerate(doc):
        prompt = ("This is a scanned page of a TNPSC answer key. It is EITHER the question booklet with the correct option marked by hand "
                  "(a tick ✓, circle or pen mark next to option A, B, C or D), OR an answer-key table listing question numbers with their answer letters. "
                  "A page with only questions and no marks/answers: return an empty list. For EVERY question number with an answer on the page, report which ONE option is "
                  "marked. confidence = \"high\" if the mark is clear and unambiguous, \"low\" if faint, between two options, or more than one option looks marked. "
                  "If a question is marked deleted / cancelled / 'all answers correct' / has no mark, set answer to null and explain in note.\n"
                  'Also give "subject": the paper / subject name printed at the top of the page (e.g. "GENERAL TAMIL WITH GENERAL STUDIES"), or "" if none.\n'
                  'Return JSON {"subject":"","answers":[{"no":1,"answer":"A","confidence":"high","note":""}]}')
        try:
            data = gemini([img_part(page, 200), {"text": prompt}])
        except Exception as e:
            print(f"  key page {i + 1}: failed ({e})")
            continue
        subj = str(data.get("subject") or "").upper()
        want = os.environ.get("KEY_SUBJECT", "TAMIL").upper()
        if subj and want and want not in subj:
            print(f"  key page {i + 1}: '{subj}' — not this paper, skipped")
            continue
        for a in data.get("answers", []):
            no = a.get("no")
            if not isinstance(no, int):
                continue
            ans = a.get("answer")
            idx = L.index(ans) if ans in L else None
            prev = out.get(no)
            # the same question can appear twice (Tamil + English pages): disagreement → low confidence
            if prev and prev["answer"] is not None and idx is not None and prev["answer"] != idx:
                prev["confidence"] = "low"
                prev["note"] = (prev.get("note") or "") + " different marks on two pages"
                continue
            if not prev or (prev["answer"] is None and idx is not None):
                out[no] = {"answer": idx, "confidence": a.get("confidence", "low"), "note": a.get("note", "")}
        print(f"  key page {i + 1}/{len(doc)}: total {len(out)}")
        time.sleep(4)
    return out


def solve_and_tag(qs, exam):
    """Independent AI answer (only used to FLAG disagreements) + syllabus unit for each question."""
    units = UNITS[exam]
    res = {}
    nos = sorted(qs)
    for i in range(0, len(nos), 20):
        batch = nos[i:i + 20]
        text = "\n\n".join(f"[{n}] {qs[n]['stem']}\n" + "  ".join(f"({L[k]}) {o}" for k, o in enumerate(qs[n]["options"])) for n in batch)
        prompt = ("For each TNPSC question below: (1) your answer A/B/C/D, (2) the best syllabus unit id from: "
                  + "; ".join(f"{k} = {v}" for k, v in units.items())
                  + ". (3) ONLY for aptitude / mental ability / reasoning questions, apt_topic = one of: " + "; ".join(f"{k} = {v}" for k, v in APT_TOPICS.items())
                  + ' (empty for other questions). Return JSON {"items":[{"no":1,"answer":"A","unit_id":"","apt_topic":""}]}\n\n' + text)
        try:
            try:
                data = sarvam_chat(prompt) if READER == "sarvam" else (_groq(prompt, 0) if GROQ else gemini([{"text": prompt}]))
            except Exception:
                data = gemini([{"text": prompt}])
            for it in data.get("items", []):
                if isinstance(it.get("no"), int):
                    res[it["no"]] = {"ai": L.index(it["answer"]) if it.get("answer") in L else None,
                                     "unit_id": it.get("unit_id") if it.get("unit_id") in units else None,
                                     "apt_topic": it.get("apt_topic") if it.get("apt_topic") in APT_TOPICS else None}
        except Exception as e:
            print(f"  solve batch {i // 20 + 1}: failed ({e})")
        time.sleep(4)
    return res


def sb(method, path, **kw):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    h.update(kw.pop("headers", {}))
    r = requests.request(method, f"{URL}/rest/v1/{path}", headers=h, timeout=120, **kw)
    if r.status_code >= 300:
        raise SystemExit(f"supabase {r.status_code}: {r.text[:300]}")
    return r


def norm(s):
    return re.sub(r"[\s.?!,:;\"'()\-–]+", " ", s).strip().lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("question_url"); ap.add_argument("key_url")
    ap.add_argument("--exam", default="G4", choices=list(UNITS)); ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--import", dest="do_import", action="store_true")
    a = ap.parse_args()
    if READER == "sarvam" and not SARVAM:
        raise SystemExit("SARVAM_API_KEY missing")
    if READER != "sarvam" and not GEMINI:
        raise SystemExit("GEMINI_API_KEY missing")

    qdoc = download(a.question_url, f"{a.exam}-{a.year}-paper.pdf")
    kdoc = qdoc if a.key_url == a.question_url else download(a.key_url, f"{a.exam}-{a.year}-key.pdf")
    print(f"question paper: {len(qdoc)} pages · answer key: {len(kdoc)} pages")

    small_key = len(kdoc) <= 6 and kdoc is not qdoc and not os.environ.get("SKIP_KEY")
    key = {}
    if small_key:  # separate answer-key table: read it first (a few Gemini calls) — no key, no import
        print("\n== reading the answer key"); key = read_key(kdoc)
        if len(key) < 50:
            raise SystemExit(f"answer key could not be read ({len(key)} answers) — Gemini's daily limit is probably used up; run again after 1:30 PM IST")
    print("\n== reading questions"); qs = read_questions(qdoc)
    if len(qs) < 150 and kdoc is not qdoc and not small_key:  # the key booklet also contains the questions — use it as a second source
        print("\n== few questions in the paper; reading questions from the answer-key booklet too")
        for n, q in read_questions(kdoc).items():
            qs.setdefault(n, q)
    if os.environ.get("SKIP_KEY"):
        print(f"\nSKIP_KEY test: {len(qs)} questions read · groq tokens used {TOKENS[0]}")
        print(f"clean: {sum(1 for q in qs.values() if not q.get('ocr_doubt'))} · OCR doubt: {sum(1 for q in qs.values() if q.get('ocr_doubt'))}")
        for n in sorted(qs)[:8]:
            print(f"\n[{n}]{' (DOUBT)' if qs[n].get('ocr_doubt') else ''} {qs[n]['stem']}\n   " + " | ".join(qs[n]['options']))
        return
    if not small_key:
        print("\n== reading ticks in the answer key"); key = read_key(kdoc)
    print("\n== independent check + syllabus units"); extra = solve_and_tag(qs, a.exam)

    if time.time() - STARTED > BUDGET:
        print("\n!! ran out of time — some pages were skipped. Showing a preview only; nothing will be stored. Run it again.")
        a.do_import = False

    rows, report = [], []
    for n in sorted(set(qs) | set(key)):
        q, k, x = qs.get(n), key.get(n, {}), extra.get(n, {})
        flags = []
        if not q: flags.append("question text not found")
        if k.get("answer") is None: flags.append("no answer in key" + (f" ({k.get('note')})" if k.get("note") else ""))
        if k.get("confidence") == "low": flags.append("tick unclear")
        if k.get("answer") is not None and x.get("ai") is not None and x["ai"] != k["answer"]: flags.append(f"AI would answer {L[x['ai']]}")
        if q and len({norm(o) for o in q["options"]}) < 4: flags.append("options not distinct")
        if q and q.get("ocr_doubt"): flags.append("OCR text unclear")
        report.append({"no": n, "stem": (q or {}).get("stem", "")[:90], "answer": L[k["answer"]] if k.get("answer") is not None else None,
                       "confidence": k.get("confidence"), "ai": L[x["ai"]] if x.get("ai") is not None else None, "unit": x.get("unit_id"), "flags": flags})
        if q and k.get("answer") is not None and "options not distinct" not in flags:
            cancelled = "cancel" in (k.get("note") or "").lower() or "delet" in (k.get("note") or "").lower()
            if cancelled:
                continue
            rows.append({
                "stem": q["stem"], "options": q["options"], "answer_index": k["answer"], "unit_id": x.get("unit_id"),
                "exam_code": a.exam, "origin": "pyq", "pyq_year": a.year, "difficulty": "medium",
                "style": f"apt:{x['apt_topic']}" if x.get("apt_topic") else None,
                "source_ref": f"TNPSC {EXAM_NAME[a.exam]} {a.year} – வினா {n} (அதிகாரபூர்வ விடைக்குறிப்பு)",
                "status": "flagged" if flags else "active",
                "verify_note": "; ".join(flags) if flags else None,
                "hash": hashlib.sha1((norm(q["stem"]) + "|" + "|".join(sorted(norm(o) for o in q["options"]))).encode()).hexdigest(),
            })

    flagged = [r for r in report if r["flags"]]
    print(f"\n==== SUMMARY: {len(qs)} questions read · {sum(1 for r in report if r['answer'])} answers read · "
          f"{len(rows)} ready · {len(flagged)} flagged for review")
    print("\nFirst 25 (compare with the PDF):")
    for r in report[:25]:
        print(f"  Q{r['no']:>3}  ticked={r['answer'] or '-'} ({r['confidence'] or '-'})  ai={r['ai'] or '-'}  {r['unit'] or '':<11} {r['stem'][:60]}  {'⚑ ' + '; '.join(r['flags']) if r['flags'] else ''}")
    if flagged:
        print("\nFlagged:")
        for r in flagged[:80]:
            print(f"  Q{r['no']:>3}: {'; '.join(r['flags'])}")
    if READER == "sarvam":
        print(f"\nSarvam use: {SPENT['pages']} pages read · {SPENT['in']} tokens in · {SPENT['out']} tokens out · ≈ ₹{SPENT['pages'] * 0.5 + (SPENT['in'] * 10 + SPENT['out'] * 25) / 1e6:.0f} + GST (if parse is ₹0.50/page)")
    pathlib.Path("pyq_report.json").write_text(json.dumps({"report": report, "rows": rows}, ensure_ascii=False, indent=1))

    if not a.do_import:
        print("\nPreview only — nothing stored. Run again with import ticked to store these questions.")
        return
    if len(qs) < int(os.environ.get("MIN_QUESTIONS", "150")):
        raise SystemExit("too few questions were read — not importing. Check the report.")
    if not (URL and KEY):
        raise SystemExit("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    for i in range(0, len(rows), 100):
        sb("POST", "questions", params={"on_conflict": "hash"}, data=json.dumps(rows[i:i + 100]),
           headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    sb("POST", "job_runs", data=json.dumps({"job": "import_pyq", "ok": True, "detail": {"exam": a.exam, "year": a.year, "tag": os.environ.get("PAPER_TAG", ""), "stored": len(rows), "flagged": len(flagged)}}),
       headers={"Prefer": "return=minimal"})
    print(f"\nStored {len(rows)} questions ({sum(1 for r in rows if r['status'] == 'flagged')} flagged — check them in வினா வங்கி).")


if __name__ == "__main__":
    main()
