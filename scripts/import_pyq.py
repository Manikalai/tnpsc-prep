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
    cmd = ["tesseract", f, "-", "-l", "tam+eng", "--psm", "4"]
    if os.environ.get("TESSDATA_BEST"):
        cmd += ["--tessdata-dir", os.environ["TESSDATA_BEST"]]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    os.remove(f)
    return out


def read_questions(doc):
    """{no: {stem, options}} from the question paper. Scanned pages: OCR text tidied by a text AI (Groq first,
    Gemini only as a fallback) so Gemini's small daily quota is kept for the answer-key ticks."""
    out = {}
    rng = os.environ.get("PAGES", "")
    lo, hi = (int(x) for x in rng.split("-")) if rng else (1, len(doc))
    for i, page in enumerate(doc):
        if not (lo <= i + 1 <= hi):
            continue
        layer = page.get_text("text").strip()
        scanned = len(layer) < 200
        if scanned:
            layer = ocr(page)
        layer = layer[:9000]
        if len(layer.strip()) < 40:
            continue
        prompt = ("This is page %d of a TNPSC question paper (it may be bilingual Tamil/English). Extract EVERY complete question on this page. "
                  "For each: its printed number, the question in TAMIL exactly as printed, and its four options (A)(B)(C)(D) in TAMIL exactly as printed. "
                  "Ignore option (E) 'விடை தெரியவில்லை / Answer not known'. "
                  "If a question exists only in English (e.g. an English-language section) give it as printed. Keep match-the-following lists and "
                  "statements inside the question text, one per line. Skip instructions and partial questions cut off at the page edge.\n"
                  + ("The text below is OCR of a scanned page: option letters are often garbled (e.g. '(௫0', 'BY', 'fey', 'ம', 'VOY' stand for (A)/(B)/(C)/(D) in order) "
                     "and stray marks like '|', '':' appear — clean these up, but never change the words of a question or option. "
                     "If a question or an option is unreadable, leave that question out. "
                     "Set \"clean\": false if ANY word still looks garbled or misspelt by the OCR, or if match-the-following codes are not valid, "
                     "otherwise true.\n" if scanned else "")
                  + 'Return JSON {"questions":[{"no":1,"stem":"","options":["","","",""],"clean":true}]}\n\nPAGE TEXT:\n') % (i + 1) + layer
        data = None
        try:
            data = _groq(prompt, 0) if (scanned and GROQ) else gemini([img_part(page, 170), {"text": prompt}])
        except Exception as e:
            try:
                data = gemini([{"text": prompt}]) if scanned else None
            except Exception as e2:
                print(f"  question page {i + 1}: failed ({e} | {e2})")
            if data is None and not scanned:
                print(f"  question page {i + 1}: failed ({e})")
        if not data:
            continue
        for q in data.get("questions", []):
            no = q.get("no")
            if isinstance(no, int) and len(q.get("options", [])) == 4 and q.get("stem") and no not in out and all(str(o).strip() for o in q["options"]):
                opts = [str(o).strip() for o in q["options"]]
                # match-the-following code options must each be a permutation of 1–4
                codes = [re.findall(r"\d", o) for o in opts]
                bad_codes = all(len(c) >= 3 for c in codes) and any(sorted(c) != ["1", "2", "3", "4"] for c in codes)
                out[no] = {"stem": q["stem"].strip(), "options": opts, "ocr_doubt": scanned and (q.get("clean") is False or bad_codes)}
        print(f"  question page {i + 1}/{len(doc)}{' (OCR)' if scanned else ''}: total {len(out)}")
        time.sleep(3)
    return out


def read_key(doc):
    """{no: {answer, confidence, cancelled}} from the scanned answer-key booklet (ticks)."""
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
                data = _groq(prompt, 0) if GROQ else gemini([{"text": prompt}])
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
    if not GEMINI:
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
    pathlib.Path("pyq_report.json").write_text(json.dumps({"report": report, "rows": rows}, ensure_ascii=False, indent=1))

    if not a.do_import:
        print("\nPreview only — nothing stored. Run again with import ticked to store these questions.")
        return
    if len(qs) < 150:
        raise SystemExit("too few questions were read — not importing. Check the report.")
    if not (URL and KEY):
        raise SystemExit("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    for i in range(0, len(rows), 100):
        sb("POST", "questions", params={"on_conflict": "hash"}, data=json.dumps(rows[i:i + 100]),
           headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    sb("POST", "job_runs", data=json.dumps({"job": "import_pyq", "ok": True, "detail": {"exam": a.exam, "year": a.year, "stored": len(rows), "flagged": len(flagged)}}),
       headers={"Prefer": "return=minimal"})
    print(f"\nStored {len(rows)} questions ({sum(1 for r in rows if r['status'] == 'flagged')} flagged — check them in வினா வங்கி).")


if __name__ == "__main__":
    main()
