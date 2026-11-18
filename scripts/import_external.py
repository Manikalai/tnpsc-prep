#!/usr/bin/env python3
"""Import ready-made question sets into the question bank.

  --source youth : teacher-written practice questions in data/import/youth/*.json (Tamil, with explanations)
  --source hf    : real TNPSC questions from the Hugging Face dataset snegha24/Tamil_tnpscExam

Each question is tagged with a syllabus unit by the AI, and the AI also answers it independently:
when its answer differs from the set's answer the question is stored as FLAGGED for review (the set's
answer is kept; the AI never overrides it). Preview by default; --import stores.

Env: GEMINI_API_KEY, GEMINI_MODELS (optional), and for --import NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import argparse, glob, hashlib, io, json, os, re, sys, time, pathlib
import requests

sys.path.insert(0, os.path.dirname(__file__))
from import_pyq import solve_and_tag, sb, norm, L, UNITS  # noqa: E402

TAMIL = re.compile(r"[஀-௿]")
HF_URL = "https://huggingface.co/datasets/snegha24/Tamil_tnpscExam/resolve/main/data/train-00000-of-00001.parquet"


def tamil_ok(s):
    letters = [c for c in s if c.isalpha()]
    return bool(letters) and sum(1 for c in letters if TAMIL.match(c)) / len(letters) >= 0.4


def load_youth():
    out = []
    for f in sorted(glob.glob("data/import/youth/*.json")):
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            print(f"  skip {f}: {e}")
            continue
        rows = data if isinstance(data, list) else data.get("questions", [])
        name = pathlib.Path(f).stem.lower()
        exam = "G1" if name.startswith("gr1") else "G2" if name.startswith("gr2") else "G4"
        for r in rows:
            if not isinstance(r, dict):
                continue
            txt = lambda v: str(v).strip() if v is not None else ""
            stem = txt(r.get("Question_TA"))
            opts = [txt(r.get(f"Option_{k}_TA")) for k in "ABCD"]
            ans = txt(r.get("Correct")).upper()[:1]
            if not stem or not all(opts) or ans not in "ABCD" or not ans or not tamil_ok(stem):
                continue  # answer (E) "none of the above" doesn't fit a 4-option paper → skipped
            d = (txt(r.get("Difficulty")) or "medium").lower()
            out.append({"exam": exam, "stem": stem, "options": opts, "answer_index": "ABCD".index(ans),
                        "explanation": txt(r.get("Explanation_TA")) or None,
                        "difficulty": d if d in ("easy", "medium", "hard") else "medium",
                        "origin": "practice", "year": None, "ref": "பயிற்சி வினா"})
    return out


def load_hf():
    import pyarrow.parquet as pq
    last = None
    for attempt in range(6):  # Hugging Face sometimes answers 502 — retry
        try:
            r = requests.get(HF_URL, timeout=120)
            if r.status_code == 200:
                break
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = str(e)
        print(f"  hugging face: {last}; retrying in {30 * (attempt + 1)}s")
        time.sleep(30 * (attempt + 1))
    else:
        raise SystemExit(f"Hugging Face not reachable ({last}). Run again later.")
    rows = pq.read_table(io.BytesIO(r.content)).to_pylist()
    out = []
    for r in rows:
        stem = (r.get("question") or "").strip()
        opts = r.get("options") or []
        if isinstance(opts, str):
            try:
                opts = json.loads(opts)
            except Exception:
                opts = []
        opts = [str(o).strip() for o in opts][:4]
        try:
            ans = int(r.get("answer")) - 1
        except Exception:
            continue
        if not stem or len(opts) != 4 or not all(opts) or not 0 <= ans <= 3:
            continue
        src = f"{r.get('source') or ''} {r.get('file_name') or ''}"
        year = int(m.group(0)) if (m := re.search(r"20\d\d", src)) else None
        g = src.upper()
        exam = "G1" if re.search(r"GROUP[\s_-]*(I\b|1\b)|GR[\s_-]*1\b", g) else "G2" if re.search(r"GROUP[\s_-]*(II|2)\b|GR[\s_-]*2\b", g) else "G4"
        tnpsc = "TNPSC" in g or "GROUP" in g
        out.append({"exam": exam, "stem": stem, "options": opts, "answer_index": ans, "explanation": None, "difficulty": "medium",
                    "origin": "pyq" if tnpsc and year else "practice", "year": year if tnpsc else None,
                    "ref": None})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["youth", "hf"], required=True)
    ap.add_argument("--import", dest="do_import", action="store_true")
    a = ap.parse_args()
    items = load_youth() if a.source == "youth" else load_hf()
    print(f"loaded {len(items)} usable questions")

    # de-duplicate by question text + options
    seen, uniq = set(), []
    for it in items:
        h = hashlib.sha1((norm(it["stem"]) + "|" + "|".join(sorted(norm(o) for o in it["options"]))).encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        it["hash"] = h
        uniq.append(it)
    print(f"{len(uniq)} after removing duplicates")

    rows, flagged = [], 0
    for exam in ("G4", "G2", "G1"):
        group = [it for it in uniq if it["exam"] == exam]
        if not group:
            continue
        print(f"\n== {exam}: tagging units + independent check for {len(group)} questions")
        qs = {i: {"stem": it["stem"], "options": it["options"]} for i, it in enumerate(group)}
        extra = solve_and_tag(qs, exam)
        for i, it in enumerate(group):
            x = extra.get(i, {})
            flags = []
            if x.get("ai") is not None and x["ai"] != it["answer_index"]:
                flags.append(f"AI would answer {L[x['ai']]}, set says {L[it['answer_index']]}")
            if len({norm(o) for o in it["options"]}) < 4:
                continue
            flagged += bool(flags)
            ref = it["ref"] or (f"TNPSC {exam} {it['year']}" if it["origin"] == "pyq" else "பயிற்சி வினா")
            rows.append({
                "stem": it["stem"], "options": it["options"], "answer_index": it["answer_index"],
                "explanation": it["explanation"], "difficulty": it["difficulty"], "unit_id": x.get("unit_id"),
                "exam_code": exam, "origin": it["origin"], "pyq_year": it["year"], "source_ref": ref,
                "status": "flagged" if flags else "active", "verify_note": "; ".join(flags) or None, "hash": it["hash"],
            })
    print(f"\n==== SUMMARY: {len(rows)} ready · {flagged} flagged (AI disagrees with the set's answer)")
    for r in rows[:15]:
        print(f"  [{r['exam_code']} {r['unit_id'] or '-':<11}] ans={L[r['answer_index']]} {r['stem'][:70]}  {'⚑ ' + r['verify_note'] if r['verify_note'] else ''}")
    pathlib.Path("external_report.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    if not a.do_import:
        print("\nPreview only — nothing stored.")
        return
    for i in range(0, len(rows), 100):
        sb("POST", "questions", params={"on_conflict": "hash"}, data=json.dumps(rows[i:i + 100]),
           headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    sb("POST", "job_runs", data=json.dumps({"job": f"import_{a.source}", "ok": True, "detail": {"stored": len(rows), "flagged": flagged}}),
       headers={"Prefer": "return=minimal"})
    print(f"\nStored {len(rows)} questions ({flagged} flagged — check them in வினா வங்கி).")


if __name__ == "__main__":
    main()
