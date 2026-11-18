import { NextResponse } from "next/server";
import { apiUser } from "@/lib/supabase/server";
import { loadExam } from "@/lib/exam";

export const maxDuration = 60;

// Everything needed to practise offline for one exam: blueprint, question bank (with answers),
// last 30 days of current affairs + their MCQs, notes for the exam's units, the user's flashcards.
export async function GET(req: Request) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { sb, user } = ctx;
  const exam = new URL(req.url).searchParams.get("exam") ?? "G4";
  const { exam: examRow, parts, units } = await loadExam(sb, exam);
  if (!examRow) return NextResponse.json({ error: "exam not found" }, { status: 404 });
  const unitIds = units.map((u) => u.id);
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const cols = "id,unit_id,stem,options,answer_index,explanation,source_ref,origin,pyq_year,ca_date";

  const questions: unknown[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await sb.from("questions").select(cols).eq("status", "active").in("unit_id", unitIds).range(from, from + 999);
    questions.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const [{ data: caQ }, { data: ca }, { data: notes }, { data: cards }] = await Promise.all([
    sb.from("questions").select(cols).eq("origin", "ca").eq("status", "active").gte("ca_date", since).limit(1000),
    sb.from("current_affairs").select("*").gte("ca_date", since).order("ca_date", { ascending: false }).limit(2000),
    sb.from("notes").select("id,unit_id,kind,title,content,source_ref").in("unit_id", unitIds).limit(2000),
    sb.from("flashcards").select("id,front,back").eq("user_id", user.id).limit(3000),
  ]);
  return NextResponse.json(
    { version: 1, downloadedAt: new Date().toISOString(), exam: examRow, parts, units, questions: [...questions, ...(caQ ?? [])], ca: ca ?? [], notes: notes ?? [], flashcards: cards ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
