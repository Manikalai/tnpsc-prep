// Syllabus topic → textbook lessons that teach it (built by scripts/map_topics.ts, stored in Storage meta/topic-lessons.json).
import { unstable_cache } from "next/cache";

export type TopicLessons = { exams: Record<string, Record<string, number[]>>; lessons: Record<string, [number, string, number, string]> };
export type LessonLink = { id: number; std: number; subject: string; no: number; title: string };

const load = unstable_cache(
  async (): Promise<TopicLessons | null> => {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/meta/topic-lessons.json`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as TopicLessons) : null;
    } catch { return null; }
  },
  ["topic-lessons-v1"],
  { revalidate: 900 },
);

/** lessons for each topic of an exam: { topicId: LessonLink[] } */
export async function topicLessons(exam: string): Promise<Record<string, LessonLink[]>> {
  const d = await load();
  if (!d) return {};
  const out: Record<string, LessonLink[]> = {};
  for (const [tid, ids] of Object.entries(d.exams[exam] ?? {}))
    out[tid] = ids.map((id) => { const l = d.lessons[id]; return l ? { id, std: l[0], subject: l[1], no: l[2], title: l[3] } : null; }).filter(Boolean) as LessonLink[];
  return out;
}
