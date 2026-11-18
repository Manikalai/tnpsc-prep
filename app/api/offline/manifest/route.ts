import { NextResponse } from "next/server";
import { apiUser } from "@/lib/supabase/server";

export const maxDuration = 60;

// Small metadata for offline mode: exams + blueprints, lesson list, current affairs (60 days), notes, flashcards.
export async function GET() {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { sb, user } = ctx;
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const [{ data: exams }, { data: parts }, { data: units }, { data: chapters }, { data: ca }, { data: notes }, { data: cards }, { count }] = await Promise.all([
    sb.from("exams").select("*"),
    sb.from("parts").select("*").order("sort"),
    sb.from("units").select("id,part_id,exam_code,name_ta,questions,subject,sort").order("sort"),
    sb.from("chapters").select("*").order("std").order("term").order("chapter_no").limit(5000),
    sb.from("current_affairs").select("*").gte("ca_date", since).order("ca_date", { ascending: false }).limit(3000),
    sb.from("notes").select("id,unit_id,kind,title,content,source_ref").limit(3000),
    sb.from("flashcards").select("id,front,back").eq("user_id", user.id).limit(5000),
    sb.from("questions").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);
  return NextResponse.json(
    { serverTime: new Date().toISOString(), exams, parts, units, chapters, ca, notes, flashcards: cards, questionCount: count ?? 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
