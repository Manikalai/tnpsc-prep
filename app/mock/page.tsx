import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { EXAM_LABEL, getProfile } from "@/lib/data";
import { loadExam } from "@/lib/exam";
import { taDate } from "@/lib/format";
import ExamTabs from "@/components/ExamTabs";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";

export default async function Mock({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const sp = await searchParams;
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const code = sp.exam ?? profile.target_exam;
  const [{ exam, parts, units }, { data: counts }, { data: past }] = await Promise.all([
    loadExam(sb, code),
    sb.from("bank_counts").select("*"),
    sb.from("tests").select("id,title,score,max_score,started_at,submitted_at,result").eq("user_id", user.id).eq("kind", "mock").eq("exam_code", code).order("started_at", { ascending: false }).limit(20),
  ]);
  const have = new Map<string, number>();
  for (const c of counts ?? []) if (c.unit_id) have.set(c.unit_id, (have.get(c.unit_id) ?? 0) + c.n);
  const ready = units.reduce((s, u) => s + Math.min(have.get(u.id) ?? 0, u.questions), 0);

  return (
    <div className="space-y-4">
      <h1 className="h1">மாதிரித் தேர்வு</h1>
      <ExamTabs base="/mock" current={code} />
      {exam && (
        <div className="card">
          <h2 className="h2">{exam.name_ta}</h2>
          <p className="muted">{exam.total_questions} வினாக்கள் · {exam.total_marks} மதிப்பெண் · {exam.duration_min / 60} மணி நேரம் · எதிர்மறை மதிப்பெண் இல்லை</p>
          <ul className="mt-3 space-y-1 text-sm">
            {parts.map((p) => (
              <li key={p.id} className="flex justify-between"><span>{p.name_ta}</span><span className="font-semibold">{p.questions}</span></li>
            ))}
          </ul>
          <div className="mt-3 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.round((ready / exam.total_questions) * 100)}%` }} /></div>
          <p className="muted mt-1">வினா வங்கி தயார்நிலை: {ready}/{exam.total_questions}. {ready < exam.total_questions && <Link className="underline" href="/admin">Fill question bank →</Link>}</p>
          <div className="mt-4">
            <StartButton url="/api/mock" body={{ exam: code }} label="Start mock test" busyLabel="Preparing paper…" confirm={`${EXAM_LABEL[code]} மாதிரித் தேர்வு ${exam.duration_min / 60} மணி நேரம். தொடங்கலாமா?`} />
          </div>
        </div>
      )}
      <Link href="/papers" className="card block hover:border-brand-500">
        <p className="font-semibold">TNPSC உண்மை வினாத்தாள்கள் →</p>
        <p className="muted">முந்தைய ஆண்டு வினாத்தாளை அதிகாரபூர்வ விடைகளுடன் எழுதுங்கள்</p>
      </Link>
      <div className="card">
        <h2 className="h2 mb-2">முந்தைய மாதிரித் தேர்வுகள்</h2>
        {!past?.length && <p className="muted">இன்னும் இல்லை.</p>}
        <ul className="divide-y divide-stone-100">
          {(past ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <Link href={t.submitted_at ? `/test/${t.id}/result` : `/test/${t.id}`} className="underline">{taDate(t.started_at)}</Link>
              <span>
                {t.submitted_at ? <b>{Number(t.score)}/{Number(t.max_score)}</b> : <span className="chip">தொடர்க</span>}
                {t.result?.gatePassed === false && <span className="ml-2 text-xs text-kumkum-500">தமிழ் தகுதி இல்லை</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
