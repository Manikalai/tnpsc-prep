import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { EXAM_LABEL, getProfile } from "@/lib/data";
import { buildPlan, type PlanDay } from "@/lib/plan";
import { pct } from "@/lib/format";
import StartButton from "@/components/StartButton";
import Emoji from "@/components/Emoji";
import TopicLessons from "@/components/TopicLessons";
import { topicLessons, type LessonLink } from "@/lib/topic-lessons";
import TopicDone from "@/components/TopicDone";

export const dynamic = "force-dynamic";

const WD = ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"];
const MON = ["ஜன", "பிப்", "மார்", "ஏப்", "மே", "ஜூன்", "ஜூலை", "ஆக", "செப்", "அக்", "நவ", "டிச"];
const label = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${WD[d.getUTCDay()]} · ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

function DayBody({ d, today, tl }: { d: PlanDay; today: boolean; tl: Record<string, LessonLink[]> }) {
  if (d.kind === "mock") return (
    <div className="space-y-2">
      <p className="text-[15px]">முழு மாதிரித் தேர்வு (3 மணி நேரம்) + தவறியவற்றைத் திருப்புதல்</p>
      {today && <Link href="/mock" className="btn btn-sm">Start mock test</Link>}
    </div>
  );
  if (d.kind === "revision") return (
    <div className="space-y-2">
      <p className="text-[15px]">திருப்புதல் மட்டும்: திருப்புதல் பட்டியல் · நினைவு அட்டைகள் · முக்கியக் குறிப்புகள் · ஒரு மாதிரித் தேர்வு</p>
      {today && <div className="flex flex-wrap gap-2"><Link href="/revision" className="btn btn-sm">Revision</Link><Link href="/mock" className="btn-ghost btn-sm">Mock test</Link></div>}
    </div>
  );
  return (
    <ul className="divide-y divide-stone-100">
      {d.topics.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-2">
          {today && <TopicDone topicId={t.id} />}
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium leading-snug">{t.name}</span><span className="block text-xs text-stone-500">{t.unit}</span><TopicLessons lessons={tl[t.id]} open={today} /></span>
          {today && <StartButton url="/api/quiz" body={{ unitId: t.unitId, topicId: t.id, count: 10 }} label="Quiz" busyLabel="…" className="shrink-0 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold" />}
        </li>
      ))}
      {!d.topics.length && <li className="py-2 text-[15px] text-stone-500">புதிய தலைப்பு இல்லை — திருப்புதல் நாள்</li>}
    </ul>
  );
}

export default async function Planner() {
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const code = profile.target_exam;
  const [plan, tl] = await Promise.all([buildPlan(sb, user.id, code, profile.exam_date ?? null), topicLessons(code)]);
  const examDate = plan.examDate;
  const [today, ...rest] = plan.days;
  const KIND = { study: ["books", "படிப்பு"], mock: ["stopwatch", "மாதிரித் தேர்வு"], revision: ["repeat", "திருப்புதல்"] } as const;
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-maroon-700 via-maroon-600 to-saffron-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <Emoji name="calendar" size={44} />
          <div>
            <p className="text-sm text-white/80">{EXAM_LABEL[code]}{examDate ? ` · ${label(examDate)}` : ""}</p>
            <p className="text-2xl font-bold">இன்னும் {plan.daysLeft} நாட்கள்</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/85">மீதமுள்ள {plan.remaining} தலைப்புகள் · நாளொன்றுக்கு {plan.perDay} · ஞாயிறுதோறும் மாதிரித் தேர்வு · கடைசி {plan.revisionDays} நாட்கள் திருப்புதல் மட்டும்</p>
        <div className="mt-3 h-2 rounded-full bg-white/25"><div className="h-2 rounded-full bg-gold-400" style={{ width: `${pct(plan.done, plan.total)}%` }} /></div>
        <p className="mt-1 text-xs text-white/80">{plan.done}/{plan.total} தலைப்புகள் முடிந்தன</p>
      </section>
      {!examDate && <p className="card text-sm">தேர்வு தேதி இல்லை — 50 நாள் திட்டம் காட்டப்படுகிறது. <Link href="/settings" className="underline">Settings</Link>-இல் தேதியைச் சேர்க்கவும்.</p>}

      {today && (
        <section className="card ring-2 ring-saffron-400/60">
          <div className="mb-2 flex items-center gap-2"><Emoji name={KIND[today.kind][0]} size={28} /><h2 className="h2">Today · {KIND[today.kind][1]}</h2></div>
          <DayBody d={today} today tl={tl} />
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[13.5px] leading-relaxed text-stone-700">
            தினமும்: <Link href="/ca" className="font-semibold underline">நடப்பு நிகழ்வுகள்</Link> 15 நிமி · <Link href="/revision" className="font-semibold underline">திருப்புதல்</Link> + <Link href="/flashcards" className="font-semibold underline">அட்டைகள்</Link> 20 நிமி · <Link href="/aptitude" className="font-semibold underline">திறனறிவு</Link> 10 வினா · <Link href="/tamil" className="font-semibold underline">பொதுத் தமிழ்</Link> 15 வினா
          </div>
          <p className="muted mt-2 text-xs">தலைப்பை முடித்ததும் ✓ குறியிடுங்கள். விடுபட்டவை தானாக அடுத்த நாட்களுக்கு நகரும்.</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="h2 px-1">Next days</h2>
        {rest.slice(0, 60).map((d) => (
          <details key={d.date} className="card group !py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <Emoji name={KIND[d.kind][0]} size={22} />
              <span className="flex-1 font-semibold">{label(d.date)}</span>
              <span className={`chip ${d.kind === "mock" ? "!bg-maroon-600 !text-white" : d.kind === "revision" ? "!bg-saffron-500 !text-white" : ""}`}>{d.kind === "study" ? `${d.topics.length} தலைப்புகள்` : KIND[d.kind][1]}</span>
            </summary>
            <div className="mt-2"><DayBody d={d} today={false} tl={tl} /></div>
          </details>
        ))}
      </section>
    </div>
  );
}
