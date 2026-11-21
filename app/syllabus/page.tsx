import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { loadExam } from "@/lib/exam";
import { pct } from "@/lib/format";
import ExamTabs from "@/components/ExamTabs";
import StatusSelect from "@/components/StatusSelect";
import TopicLessons from "@/components/TopicLessons";
import { topicLessons } from "@/lib/topic-lessons";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";

export default async function Syllabus({ searchParams }: { searchParams: Promise<{ exam?: string; unit?: string }> }) {
  const sp = await searchParams;
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const code = sp.exam ?? profile.target_exam;
  const [{ exam, parts, units }, tl] = await Promise.all([loadExam(sb, code), topicLessons(code)]);
  const { data: topics } = await sb.from("topics").select("id,unit_id,sort,name_ta").in("unit_id", units.map((u) => u.id)).order("sort");
  const { data: prog } = await sb.from("progress").select("topic_id,status").eq("user_id", user.id);
  const status = new Map((prog ?? []).map((p) => [p.topic_id, p.status]));
  const { data: acc } = await sb.from("unit_accuracy").select("*").eq("user_id", user.id);
  const accMap = new Map((acc ?? []).map((a) => [a.unit_id, a]));

  if (!exam) return <p className="card">பாடத்திட்டம் இன்னும் ஏற்றப்படவில்லை (README: seed SQL).</p>;
  return (
    <div>
      <p className="muted mb-3">ஒவ்வொரு தலைப்பையும் படித்தபின் நிலையை மாற்றுங்கள்; அலகை முடித்ததும் வினாடி வினா எடுங்கள்.</p>
      <ExamTabs base="/syllabus" current={code} />
      {exam.notes_ta && <p className="mb-3 rounded-xl bg-turmeric-50 p-3 text-sm">{exam.notes_ta}</p>}
      {parts.map((p) => (
        <section key={p.id} className="mb-5">
          <h2 className="mb-2 text-lg font-bold text-brand-700">{p.name_ta} <span className="text-sm font-normal text-stone-500">· {p.questions} வினாக்கள்</span></h2>
          <div className="space-y-2">
            {units.filter((u) => u.part_id === p.id).map((u) => {
              const ts = (topics ?? []).filter((t) => t.unit_id === u.id);
              const done = ts.filter((t) => ["done", "revised"].includes(status.get(t.id) ?? "")).length;
              const a = accMap.get(u.id);
              return (
                <details key={u.id} className="card group" open={sp.unit === u.id}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{u.name_ta}</p>
                      <p className="muted">
                        {u.questions} வினாக்கள்{u.approx ? " (தோராயம்)" : ""} · {done}/{ts.length} தலைப்புகள்
                        {a ? ` · சரியானவை ${pct(a.correct, a.attempted)}%` : ""}
                      </p>
                    </div>
                  </summary>
                  <div className="mt-3 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct(done, ts.length)}%` }} /></div>
                  <ul className="mt-3 divide-y divide-stone-100">
                    {ts.map((t) => (
                      <li key={t.id} className="flex items-start justify-between gap-2 py-2">
                        <div className="min-w-0"><span className="text-sm">{t.name_ta}</span><TopicLessons lessons={tl[t.id]} /></div>
                        <div className="flex shrink-0 items-center gap-2">
                          {u.subject !== "aptitude" && u.subject !== "reasoning" && (
                            <StartButton url="/api/quiz" body={{ unitId: u.id, topicId: t.id, count: 10 }} label="Quiz" className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold" busyLabel="…" />
                          )}
                          <StatusSelect topicId={t.id} initial={status.get(t.id) ?? "todo"} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {u.subject === "aptitude" || u.subject === "reasoning" ? (
                      <Link href="/aptitude" className="btn btn-sm">Aptitude practice</Link>
                    ) : (
                      <StartButton url="/api/quiz" body={{ unitId: u.id, count: 15 }} label="15 questions from this unit" className="btn btn-sm" busyLabel="Preparing questions… (up to 30 sec)" />
                    )}
                    <Link href={`/notes?unit=${u.id}`} className="btn-ghost btn-sm">Memory notes</Link>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
