import { NextResponse } from "next/server";
import { apiUser } from "@/lib/supabase/server";

export const maxDuration = 60;

// Saved detailed explanations, 500 per page: ?offset=0&since=ISO
export async function GET(req: Request) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const offset = Number(u.get("offset") ?? 0);
  let q = ctx.sb.from("question_explanations").select("question_id,content,created_at").order("created_at").range(offset, offset + 499);
  if (u.get("since")) q = q.gt("created_at", u.get("since")!);
  const { data } = await q;
  return NextResponse.json({ rows: data ?? [], done: (data?.length ?? 0) < 500 }, { headers: { "Cache-Control": "no-store" } });
}
