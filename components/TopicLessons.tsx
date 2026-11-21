import Link from "next/link";
import type { LessonLink } from "@/lib/topic-lessons";

const SUBJ: Record<string, string> = { tamil: "தமிழ்", social: "சமூக அறிவியல்", science: "அறிவியல்", history: "வரலாறு", geography: "புவியியல்", economics: "பொருளியல்", "political science": "அரசியல் அறிவியல்" };

// the textbook lessons that teach a syllabus topic (tap → lesson with all its tabs)
export default function TopicLessons({ lessons, open = false }: { lessons?: LessonLink[]; open?: boolean }) {
  if (!lessons?.length) return null;
  return (
    <details className="group mt-1" open={open}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
        📖 {lessons.length} பாடம்{lessons.length > 1 ? "கள்" : ""} <span className="transition group-open:rotate-180">▾</span>
      </summary>
      <ul className="mt-1.5 space-y-1">
        {lessons.map((l) => (
          <li key={l.id}>
            <Link href={`/chapter/${l.id}`} className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-[13.5px] active:bg-stone-100">
              <span className="shrink-0 rounded bg-stone-100 px-1.5 text-[11px] font-bold text-stone-600">{l.std}</span>
              <span className="min-w-0"><span className="text-stone-500">{SUBJ[l.subject] ?? l.subject} · பாடம் {l.no % 100}:</span> {l.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
