import { fetchAll } from "@/lib/db";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUBJECT: Record<string, string> = { tamil: "தமிழ்", social: "சமூக அறிவியல்", science: "அறிவியல்" };
const SUBJECT_ORDER = ["tamil", "social", "science"];
type Ch = { id: number; book: string; std: number; term: string | null; subject: string; chapter_no: number; title_ta: string };

export default async function Books({ searchParams }: { searchParams: Promise<{ std?: string }> }) {
  const { std } = await searchParams;
  const { sb } = await requireUser();
  const data = await fetchAll((a, b) => sb.from("chapters").select("id,book,std,term,subject,chapter_no,title_ta").order("std").order("term").order("chapter_no").order("id").range(a, b));
  const chapters = (data ?? []) as Ch[];
  const stds = [...new Set(chapters.map((c) => c.std))].sort((a, b) => a - b);
  const current = Number(std ?? stds[0] ?? 6);
  const inStd = chapters.filter((c) => c.std === current);
  const terms = [...new Set(inStd.map((c) => c.term ?? ""))].sort();
  const { data: notes } = await sb.from("chapter_notes").select("chapter_id,kind").in("chapter_id", inStd.map((c) => c.id));
  const ready = new Map<number, number>();
  for (const n of notes ?? []) ready.set(n.chapter_id, (ready.get(n.chapter_id) ?? 0) + 1);

  return (
    <div className="space-y-4">
      {!chapters.length && <p className="card">பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை. GitHub-இல் &quot;Load textbooks&quot; பணியை இயக்கவும்.</p>}
      <div className="flex gap-2 overflow-x-auto">
        {stds.map((s) => (
          <Link key={s} href={`/books?std=${s}`} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${s === current ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>
            {s}ஆம் வகுப்பு
          </Link>
        ))}
      </div>
      {terms.map((t) => (
        <section key={t} className="space-y-3">
          {t && <h2 className="text-lg font-bold text-brand-700">பருவம் {t}</h2>}
          {SUBJECT_ORDER.filter((s) => inStd.some((c) => (c.term ?? "") === t && c.subject === s)).map((s) => {
            const list = inStd.filter((c) => (c.term ?? "") === t && c.subject === s);
            const books = [...new Set(list.map((c) => c.book))];
            return books.map((b) => (
              <details key={`${b}-${s}`} className="card" open={books.length === 1 && list.length < 12}>
                <summary className="cursor-pointer font-semibold">
                  {SUBJECT[s]} {books.length > 1 || !b.includes(SUBJECT[s]) ? <span className="font-normal text-stone-500">· {b}</span> : null}
                  <span className="ml-2 text-xs font-normal text-stone-400">{list.filter((c) => c.book === b).length} பாடங்கள்</span>
                </summary>
                <ul className="mt-2 divide-y divide-stone-100">
                  {list.filter((c) => c.book === b).map((c) => (
                    <li key={c.id}>
                      <Link href={`/chapter/${c.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-brand-600">
                        <span>{c.chapter_no}. {c.title_ta}</span>
                        <span className="shrink-0 text-xs text-stone-400">{ready.get(c.id) ? `${ready.get(c.id)}/3 தயார்` : ""} ›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ));
          })}
        </section>
      ))}
    </div>
  );
}
