#!/usr/bin/env python3
"""Turn a TNPSC previous-year question paper (PDF, Tamil version) + its answer key into JSON
for the app's "முந்தைய ஆண்டு வினாக்களைச் சேர்" box.

The AI only re-types what is printed (question, 4 options) and guesses the syllabus unit;
the correct answers come from the official answer key you provide, not from the AI.

Usage:
  python scripts/pyq_to_json.py paper.pdf --key key.txt --exam G4 --year 2024 > out.json
key.txt: one line per question, e.g. "1 C" or "1,3" (A/B/C/D or 1-4). Check out.json before importing.
Env: GEMINI_API_KEY (and GEMINI_MODEL optional)
"""
import argparse, json, os, re, sys, time
import requests, fitz

UNITS = {
  "G4": ["G4-TAMIL-1","G4-TAMIL-2","G4-TAMIL-3","G4-TAMIL-4","G4-TAMIL-5","G4-TAMIL-6","G4-TAMIL-7","G4-GS-1","G4-GS-2","G4-GS-3","G4-GS-4","G4-GS-5","G4-GS-6","G4-APT-1","G4-APT-2"],
  "G2": ["G2-TAMIL-A","G2-TAMIL-B","G2-TAMIL-C"] + [f"G2-GS-{i}" for i in range(1,10)] + ["G2-APT-1","G2-APT-2"],
  "G1": [f"G1-GS-{i}" for i in range(1,7)] + ["G1-APT-1","G1-APT-2"],
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf"); ap.add_argument("--key", required=True); ap.add_argument("--exam", required=True); ap.add_argument("--year", type=int, required=True)
    a = ap.parse_args()
    key = {}
    for line in open(a.key, encoding="utf-8"):
        m = re.match(r"\s*(\d+)\s*[,.:\s]\s*([A-Da-d1-4])", line)
        if m:
            v = m.group(2).upper()
            key[int(m.group(1))] = "ABCD".index(v) if v in "ABCD" else int(v) - 1
    text = "\n".join(p.get_text("text") for p in fitz.open(a.pdf))
    model = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
    out = []
    for start in range(0, len(text), 12000):
        part = text[start:start + 12500]
        prompt = (f"Below is part of a TNPSC question paper. Copy every complete question EXACTLY as printed (Tamil version only), "
                  f"with its number and its 4 options in order (A,B,C,D). Do not answer them. Also pick the best syllabus unit id from {UNITS[a.exam]}.\n"
                  'Return JSON {"questions":[{"no":1,"stem":"","options":["","","",""],"unit_id":""}]}\n\n' + part)
        r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                          headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"], "Content-Type": "application/json"},
                          data=json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                                           "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}), timeout=180)
        r.raise_for_status()
        data = json.loads("".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"]))
        for q in data.get("questions", []):
            no = q.get("no")
            if no in key and len(q.get("options", [])) == 4 and not any(x["no"] == no for x in out):
                out.append({"no": no, "stem": q["stem"], "options": q["options"], "answer_index": key[no],
                            "unit_id": q.get("unit_id"), "exam_code": a.exam, "year": a.year})
        time.sleep(6)
    out.sort(key=lambda x: x["no"])
    print(f"{len(out)} questions with answers (key had {len(key)})", file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
