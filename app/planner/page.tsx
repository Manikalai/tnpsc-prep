import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { EXAM_LABEL, getProfile } from "@/lib/data";
import { loadExam } from "@/lib/exam";
import { daysUntil, pct, taDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Planner() {
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const code = profile.target_exam;
  const { exam, units } = await loadExam(sb, code);
  const examDate = profile.exam_date ?? exam?.exam_date;
  const { data: topics } = await sb.from("topics").select("id,unit_id,name_ta,sort").in("unit_id", units.map((u) => u.id)).order("sort");
  const { data: prog } = await sb.from("progress").select("topic_id,status").eq("user_id", user.id);
  const status = new Map((prog ?? []).map((p) => [p.topic_id, p.status]));
  const { data: acc } = await sb.from("unit_accuracy").select("*").eq("user_id", user.id);
  const accMap = new Map((acc ?? []).map((a) => [a.unit_id, a]));

  if (!examDate) return <div className="card">முதலில் <Link href="/settings" className="underline">அமைப்புகளில்</Link> தேர்வு தேதியைச் சேர்க்கவும்.</div>;
  const days = Math.max(1, daysUntil(examDate));
  const revisionDays = Math.min(Math.round(days * 0.25), 21); // keep the last stretch for full mocks + revision
  const studyDays = Math.max(1, days - revisionDays);
  const remaining = (topics ?? []).filter((t) => !["done", "revised"].includes(status.get(t.id) ?? ""));
  const perDay = Math.ceil(remaining.length / studyDays);

  // order remaining topics: heavy units first, weak units first
  const weight = (unitId: string) => {
    const u = units.find((x) => x.id === unitId)!;
    const a = accMap.get(unitId);
    const accuracy = a && a.attempted ? a.correct / a.attempted : 0.5;
    return u.questions * (1.5 - accuracy);
  };
  const ordered = [...remaining].sort((a, b) => weight(b.unit_id) - weight(a.unit_id));
  const today = ordered.slice(0, perDay);
  const week = ordered.slice(perDay, perDay * 7);
  const uname = (id: string) => units.find((u) => u.id === id)?.name_ta ?? "";

  return (
    <div className="space-y-4">
      <h1 className="h1">படிப்புத் திட்டம்</h1>
      <div className="card">
        <p>{EXAM_LABEL[code]} · {taDate(examDate)} · இன்னும் <b>{days}</b> நாட்கள்</p>
        <p className="muted mt-1">
          மீதமுள்ள {remaining.length} தலைப்புகள் / {studyDays} படிப்பு நாட்கள் = நாளொன்றுக்கு <b>{perDay}</b> தலைப்புகள். கடைசி {revisionDays} நாட்கள் முழு மாதிரித் தேர்வுகளுக்கும் திருப்புதலுக்கும்.
        </p>
        <div className="mt-2 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct((topics?.length ?? 0) - remaining.length, topics?.length ?? 0)}%` }} /></div>
      </div>
      <div className="card">
        <h2 className="h2 mb-2">இன்று படிக்க</h2>
        <ul className="space-y-1">
          {today.map((t) => <li key={t.id}>• {t.name_ta} <span className="text-xs text-stone-500">({uname(t.unit_id)})</span></li>)}
        </ul>
        <p className="muted mt-2">ஒவ்வொரு தலைப்பையும் பாடநூலில் படித்து, <Link href="/syllabus" className="underline">பாடத்திட்டத்தில்</Link> &quot;முடிந்தது&quot; எனக் குறித்து, வினாடி வினா எடுக்கவும்.</p>
      </div>
      <div className="card">
        <h2 className="h2 mb-2">இந்த வாரம் அடுத்து</h2>
        <ul className="space-y-1 text-sm">
          {week.map((t) => <li key={t.id}>• {t.name_ta} <span className="text-xs text-stone-500">({uname(t.unit_id)})</span></li>)}
        </ul>
      </div>
      <div className="card">
        <h2 className="h2 mb-1">தினசரி வழக்கம் (பரிந்துரை)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>காலை: இன்றைய நடப்பு நிகழ்வுகள் (15 நிமிடம்) + 5 வினாக்கள்</li>
          <li>திருப்புதல் பட்டியல் + நினைவு அட்டைகள் (20 நிமிடம்)</li>
          <li>புதிய தலைப்புகள் பாடநூலில் + அலகு வினாடி வினா</li>
          <li>திறனறிவு: 10 வினாக்கள் நேரத்துடன்</li>
          <li>வாரம் ஒருமுறை முழு மாதிரித் தேர்வு; கடைசி மூன்று வாரங்களில் வாரம் மூன்று முறை</li>
        </ul>
      </div>
    </div>
  );
}
