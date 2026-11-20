"""Imports the official TNPSC past papers in data/pyq/papers.json one at a time, skipping ones already stored.
Stops for the day when Gemini's free limit runs out; the next daily run continues."""
import json, os, subprocess, sys, requests
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"); KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
done = {((r.get("detail") or {}).get("tag")) for r in requests.get(f"{URL}/rest/v1/job_runs", headers=h, params={"job": "eq.import_pyq", "select": "detail", "limit": "500"}, timeout=60).json()}
papers = json.load(open("data/pyq/papers.json"))
todo = [p for p in papers if p["tag"] not in done]
print(f"{len(papers)} papers · {len(papers) - len(todo)} done · {len(todo)} to do: {[p['tag'] for p in todo]}")
for p in todo:
    print(f"\n################ {p['tag']}", flush=True)
    env = {**os.environ, "PAPER_TAG": p["tag"], "KEY_SUBJECT": p["key_subject"], "MIN_QUESTIONS": str(p["min"])}
    r = subprocess.run([sys.executable, "scripts/import_pyq.py", p["q"], p["key"], "--exam", p["exam"], "--year", str(p["year"]), "--import"], env=env, capture_output=True, text=True)
    print(r.stdout[-6000:], r.stderr[-1500:], flush=True)
    if r.returncode != 0 and any(x in (r.stdout + r.stderr) for x in ("daily limit", "could not be read", "OutOfTime")):
        print("Gemini's daily limit is used up — stopping; tomorrow's run continues."); break
