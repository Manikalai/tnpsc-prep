import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDaily } from "@/lib/ca";
import { serverEnv } from "@/lib/env";

export const maxDuration = 60;

// Backup trigger for the daily job (GitHub Actions is the main one). Call with
// Authorization: Bearer <CRON_SECRET>. Vercel Cron sends this header automatically when CRON_SECRET is set.
export async function GET(req: Request) {
  const secret = serverEnv().cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const r = await runDaily(supabaseAdmin());
  return NextResponse.json(r);
}
