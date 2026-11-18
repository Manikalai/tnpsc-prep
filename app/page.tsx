import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { EXAM_LABEL, getProfile, todayIST } from "@/lib/data";
import { daysUntil, pct, taDate } from "@/lib/format";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const today = todayIST();
  const exam = profile.target_exam;
  const [{ data: examRow }, { count: due }, { data: units }, { data: progress }, { data: tests }, { data: profiles }, { count: caToday }, { count: cardsDue }] =
    await Promise.all([
      sb.from("exams").select("exam_date,name_ta").eq("code", exam).single(),
      sb.from("review_queue").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("due_date", today),
      sb.from("units").select("id").eq("exam_code", exam),
      sb.from("progress").select("topic_id,status").eq("user_id", user.id),
      sb.from("tests").select("user_id,kind,title,score,max_score,submitted_at").not("submitted_at", "is", null).gte("submitted_at", new Date(Date.now() - 7 * 864e5).toISOString()).order("submitted_at", { ascending: false }).limit(60),
      sb.from("profiles").select("id,display_name"),
      sb.from("current_affairs").select("*", { count: "exact", head: true }).eq("ca_date", today),
      sb.from("flashcards").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("due_date", today),
    ]);
  const { data: examTopics } = await sb.from("topics").select("id").in("unit_id", (units ?? []).map((u) => u.id));
  const topicIds = new Set((examTopics ?? []).map((t) => t.id));
  const topicCount = topicIds.size;
  const doneTopics = (progress ?? []).filter((p) => topicIds.has(p.topic_id) && (p.status === "done" || p.status === "revised")).length;
  const examDate = profile.exam_date ?? examRow?.exam_date ?? null;
  const left = examDate ? daysUntil(examDate) : null;
  const mine = (tests ?? []).filter((t) => t.user_id === user.id);
  const board = (profiles ?? []).map((p) => {
    const ts = (tests ?? []).filter((t) => t.user_id === p.id && t.max_score);
    const sc = ts.reduce((s, t) => s + Number(t.score), 0), mx = ts.reduce((s, t) => s + Number(t.max_score), 0);
    return { name: p.display_name ?? "—", tests: ts.length, acc: pct(sc, mx), me: p.id === user.id };
  });

  return (
    <div className="space-y-4">
      <section className="card bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <p className="text-sm opacity-90">வணக்கம், {profile.display_name ?? ""} · {taDate(new Date(), true)}</p>
        <h1 className="mt-1 text-2xl font-bold">{EXAM_LABEL[exam]}</h1>
        {left != null && left >= 0 ? (
          <p className="mt-1 text-lg">தேர்வுக்கு இன்னும் <span className="text-3xl font-bold">{left}</span> நாட்கள் · {taDate(examDate!)}</p>
        ) : (
          <p className="mt-1 text-sm opacity-90"><Link href="/settings" className="underline">அமைப்புகளில்</Link> தேர்வு தேதியைச் சேர்க்கவும்</p>
        )}
        <div className="mt-3 h-2 rounded-full bg-white/25"><div className="h-2 rounded-full bg-turmeric-500" style={{ width: `${pct(doneTopics, topicCount)}%` }} /></div>
        <p className="mt-1 text-sm opacity-90">பாடத்திட்டம்: {doneTopics}/{topicCount} தலைப்புகள் முடிந்தன ({pct(doneTopics, topicCount)}%) · {units?.length ?? 0} அலகுகள்</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link href="/revision" className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-kumkum-500">{due ?? 0}</p>
          <p className="text-sm">இன்று திருப்ப வேண்டிய வினாக்கள்</p>
        </Link>
        <Link href={`/ca/${today}`} className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-brand-600">{caToday ?? 0}</p>
          <p className="text-sm">இன்றைய நடப்பு நிகழ்வுகள்</p>
        </Link>
        <Link href="/flashcards" className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-turmeric-500">{cardsDue ?? 0}</p>
          <p className="text-sm">நினைவு அட்டைகள்</p>
        </Link>
        <Link href="/planner" className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-ink">{mine.length}</p>
          <p className="text-sm">இந்த வாரத் தேர்வுகள் · திட்டம் →</p>
        </Link>
      </section>

      <section className="card">
        <h2 className="h2">விரைவுத் தொடக்கம்</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <StartButton url="/api/mock" body={{ exam }} label={`${EXAM_LABEL[exam]} முழு மாதிரித் தேர்வு`} busyLabel="வினாத்தாள் தயாராகிறது…" />
          <Link href="/quiz/new" className="btn">வினாத்தாள் உருவாக்கு</Link>
          <Link href="/books" className="btn-ghost">பாடநூல்கள் – பாடம் வாரியாக</Link>
          <Link href="/syllabus" className="btn-ghost">அலகு வினாடி வினா</Link>
          <Link href="/aptitude" className="btn-ghost">திறனறிவுப் பயிற்சி</Link>
          <Link href="/ask" className="btn-ghost">பாடநூலிடம் கேள்</Link>
          <Link href="/offline" className="btn-ghost">இணையமின்றிப் பயிற்சி</Link>
        </div>
      </section>

      {board.length > 1 && (
        <section className="card">
          <h2 className="h2">இந்த வாரம் (7 நாட்கள்)</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {board.map((b) => (
              <div key={b.name} className={`rounded-xl p-3 ${b.me ? "bg-brand-50" : "bg-stone-50"}`}>
                <p className="font-semibold">{b.name}</p>
                <p className="text-2xl font-bold">{b.acc}%</p>
                <p className="muted">{b.tests} தேர்வுகள்</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section className="card">
          <h2 className="h2">சமீபத்திய தேர்வுகள்</h2>
          <ul className="mt-2 divide-y divide-stone-100">
            {mine.slice(0, 6).map((t, k) => (
              <li key={k} className="flex justify-between py-2 text-sm">
                <span className="truncate pr-2">{t.title}</span>
                <span className="shrink-0 font-semibold">{Number(t.score)}/{Number(t.max_score)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
