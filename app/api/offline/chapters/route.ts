import { NextResponse } from "next/server";
import { apiUser } from "@/lib/supabase/server";

export const maxDuration = 60;

// Lesson text + saved summary / facts / revision for up to 12 lessons: ?ids=1,2,3[&notesOnly=1]
export async function GET(req: Request) {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const ids = (u.get("ids") ?? "").split(",").map(Number).filter(Boolean).slice(0, 12);
  if (!ids.length) return NextResponse.json({ texts: [], notes: [] });
  const notesOnly = u.get("notesOnly") === "1";
  const [{ data: rows }, { data: notes }] = await Promise.all([
    notesOnly
      ? Promise.resolve({ data: [] as { chapter_id: number; page_from: number; content: string; id: number }[] })
      : ctx.sb.from("textbook_chunks").select("id,chapter_id,page_from,content").in("chapter_id", ids).order("page_from").order("id").limit(5000),
    ctx.sb.from("chapter_notes").select("chapter_id,kind,content,created_at").in("chapter_id", ids),
  ]);
  const texts = ids.map((id) => ({
    chapter_id: id,
    rows: (rows ?? []).filter((r) => r.chapter_id === id).map((r) => ({ p: r.page_from, t: r.content })),
  }));
  return NextResponse.json(
    { texts: notesOnly ? [] : texts, notes: (notes ?? []).map((n) => ({ key: `${n.chapter_id}:${n.kind}`, ...n })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
