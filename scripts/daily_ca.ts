// Daily current affairs job (GitHub Actions, ~6 AM IST, with backup runs). Also keeps the free Supabase project awake.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { runDaily, todayIST } from "../lib/ca";

const admin = supabaseAdmin();
if (process.env.GITHUB_EVENT_NAME === "schedule") {
  // GitHub sometimes skips or delays scheduled runs, so there are backup times; the first one that works does the day.
  const { data } = await admin.from("job_runs").select("id,detail").eq("job", "daily_ca").eq("ok", true).order("id", { ascending: false }).limit(5);
  if ((data ?? []).some((r: { detail: { date?: string; notes?: number } }) => r.detail?.date === todayIST() && (r.detail?.notes ?? 0) > 0)) {
    console.log("today's current affairs already done");
    process.exit(0);
  }
}
const r = await runDaily(admin);
console.log(JSON.stringify(r, null, 2));
if (!r.ok) process.exit(1);
