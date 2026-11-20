"""One-off: wipe every account's study activity (fresh start). Keeps logins, profiles and all study content."""
import os, requests
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1"; K = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": K, "Authorization": f"Bearer {K}"}
def count(t, f):
    r = requests.get(f"{URL}/{t}", headers={**H, "Prefer": "count=exact", "Range": "0-0"}, params={"select": "*", **f}, timeout=60)
    return r.headers.get("content-range", "?/?").split("/")[-1]
T = [("answers", {"user_id": "not.is.null"}), ("review_queue", {"user_id": "not.is.null"}), ("tests", {"user_id": "not.is.null"}),
     ("progress", {"user_id": "not.is.null"}), ("flashcards", {"user_id": "not.is.null"}), ("question_reports", {"user_id": "not.is.null"}),
     ("notes", {"user_id": "not.is.null"}), ("job_runs", {"job": "eq.note_report"})]
for t, f in T:
    before = count(t, f)
    r = requests.delete(f"{URL}/{t}", headers=H, params=f, timeout=120)
    print(f"{t:18} before {before:>6} · delete {r.status_code} · after {count(t, f)}")
print("profiles kept:", count("profiles", {}))
