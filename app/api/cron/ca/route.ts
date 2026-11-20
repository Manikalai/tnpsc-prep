import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDaily, todayIST } from "@/lib/ca";
import { serverEnv } from "@/lib/env";

export const maxDuration = 60;

// Backup for the daily current-affairs job: GitHub sometimes skips its scheduled runs.
// Vercel Cron calls this at ~7 AM IST (vercel.json). If today's notes are missing it starts the
// GitHub job (GH_DISPATCH_TOKEN), or runs here as a last resort. Doing nothing twice is harmless.
export async function GET(req: Request) {
  const secret = serverEnv().cronSecret;
  const auth = req.headers.get("authorization");
  const fromVercelCron = (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !fromVercelCron) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const admin = supabaseAdmin();
  const today = todayIST();
  const { count } = await admin.from("current_affairs").select("*", { count: "exact", head: true }).eq("ca_date", today);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: true, skipped: `${today} already has ${count} notes` });

  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GH_REPO || "Manikalai/tnpsc-prep";
  if (token) {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/daily-current-affairs.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "saranya-prep" },
      body: JSON.stringify({ ref: "main" }),
    });
    await admin.from("job_runs").insert({ job: "daily_ca_cron", ok: r.status === 204, detail: { date: today, dispatched: r.status } });
    if (r.status === 204) return NextResponse.json({ ok: true, dispatched: true });
  }
  return NextResponse.json(await runDaily(admin));
}
