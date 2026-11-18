import { NextResponse } from "next/server";
import { apiUser } from "@/lib/supabase/server";

export const maxDuration = 60;
const COLS = "id,exam_code,unit_id,chapter_id,stem,options,answer_index,explanation,source_ref,origin,pyq_year,ca_date,difficulty,verified,created_at";

// Pages of active questions (with answers) for offline mode. ?offset=0&since=ISO (only newer ones)
export async function GET(req: Request) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const offset = Number(u.get("offset") ?? 0);
  const since = u.get("since");
  let q = ctx.sb.from("questions").select(COLS).eq("status", "active").order("created_at").order("id").range(offset, offset + 999);
  if (since) q = q.gt("created_at", since);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [], done: (data?.length ?? 0) < 1000 }, { headers: { "Cache-Control": "no-store" } });
}
