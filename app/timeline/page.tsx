import { requireUser } from "@/lib/supabase/server";
import { parseYear, type TEvent } from "@/lib/timeline";
import Timeline from "@/components/Timeline";

export const dynamic = "force-dynamic";

type Row = { chapter_id: number; content: { dates?: { date: string; event: string }[] }; chapters: { std: number; subject: string; section: string | null; book: string; chapter_no: number; title_ta: string } | null };

export default async function TimelinePage() {
  const { sb } = await requireUser();
  const { data } = await sb.from("chapter_notes").select("chapter_id,content,chapters(std,subject,section,book,chapter_no,title_ta)").eq("kind", "facts").limit(3000);
  const events: TEvent[] = [];
  const seen = new Set<string>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const ch = r.chapters;
    if (!ch) continue;
    for (const d of r.content?.dates ?? []) {
      const y = parseYear(String(d.date ?? ""));
      if (!y || !d.event) continue;
      const key = `${y.year}|${String(d.event).slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ year: y.year, approx: y.approx, label: String(d.date), event: String(d.event), chapterId: r.chapter_id, lesson: `${ch.std}ஆம் வகுப்பு · பாடம் ${ch.chapter_no}: ${ch.title_ta}`, book: ch.book, std: ch.std, subject: ch.subject, section: ch.section });
    }
  }
  events.sort((a, b) => a.year - b.year);
  return <Timeline events={events} />;
}
