// Daily current affairs job (GitHub Actions, ~6 AM IST, with backup runs). Also keeps the free Supabase project awake.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { runDaily, todayIST } from "../lib/ca";

import { collect } from "../lib/ca";

if (process.argv.includes("--collect-only")) {
  // test the news sources: counts per source and a few headlines; nothing is stored, no AI used
  const { items, log } = await collect();
  console.log(log.join("\n"));
  for (const src of [...new Set(items.map((i) => i.source))]) {
    console.log(`\n== ${src}`);
    for (const it of items.filter((i) => i.source === src).slice(0, 5)) console.log(`  - ${it.title}${it.summary ? ` | ${it.summary.slice(0, 120)}` : ""}`);
  }
  process.exit(0);
}
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
