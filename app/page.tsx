import { Tilak } from "@/components/Murugan";
import AbodeJourney from "@/components/AbodeJourney";
import InstallApp from "@/components/InstallApp";
import { nameOfDay, sloganOfDay } from "@/lib/murugan";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { EXAM_LABEL, getProfile, todayIST } from "@/lib/data";
import { daysUntil, pct, taDate } from "@/lib/format";
import StartButton from "@/components/StartButton";
import Stories from "@/components/Stories";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const today = todayIST();
  const exam = profile.target_exam;
  const [{ data: examRow }, { count: due }, { data: units }, { data: progress }, { data: tests }, { data: profiles }, { count: caToday }, { count: cardsDue }, { data: examTopics }, { data: dailies }] =
    await Promise.all([
      sb.from("exams").select("exam_date,name_ta").eq("code", exam).single(),
      sb.from("review_queue").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("due_date", today),
      sb.from("units").select("id").eq("exam_code", exam),
      sb.from("progress").select("topic_id,status").eq("user_id", user.id),
      sb.from("tests").select("user_id,kind,title,score,max_score,submitted_at").not("submitted_at", "is", null).gte("submitted_at", new Date(Date.now() - 7 * 864e5).toISOString()).order("submitted_at", { ascending: false }).limit(60),
      sb.from("profiles").select("id,display_name"),
      sb.from("current_affairs").select("*", { count: "exact", head: true }).eq("ca_date", today),
      sb.from("flashcards").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("due_date", today),
      sb.from("topics").select("id,units!inner(exam_code)").eq("units.exam_code", exam).limit(5000),
      sb.from("tests").select("submitted_at").eq("user_id", user.id).eq("kind", "daily").not("submitted_at", "is", null).gte("submitted_at", new Date(Date.now() - 60 * 864e5).toISOString()).limit(200),
    ]);
  const topicIds = new Set((examTopics ?? []).map((t) => t.id));
  const topicCount = topicIds.size;
  const doneTopics = (progress ?? []).filter((p) => topicIds.has(p.topic_id) && (p.status === "done" || p.status === "revised")).length;
  const examDate = profile.exam_date ?? examRow?.exam_date ?? null;
  const left = examDate ? daysUntil(examDate) : null;
  const mine = (tests ?? []).filter((t) => t.user_id === user.id);
  const days = new Set((dailies ?? []).map((d) => new Date(new Date(d.submitted_at).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10)));
  let streak = 0;
  for (let d = new Date(Date.now() + 5.5 * 3600e3); ; d = new Date(d.getTime() - 864e5)) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (key !== today) break;
    if (streak > 60) break;
  }
  const doneToday = days.has(today);
  const board = (profiles ?? []).map((p) => {
    const ts = (tests ?? []).filter((t) => t.user_id === p.id && t.max_score);
    const sc = ts.reduce((s, t) => s + Number(t.score), 0), mx = ts.reduce((s, t) => s + Number(t.max_score), 0);
    return { name: p.display_name ?? "—", tests: ts.length, acc: pct(sc, mx), me: p.id === user.id };
  });

  return (
    <div className="space-y-4">
      <Stories
        items={[
          { href: `/ca/${today}`, label: "Today's CA", icon: "📰", badge: caToday ?? 0, live: (caToday ?? 0) > 0 },
          { href: "/revision", label: "Revision", icon: "🔁", badge: due ?? 0, live: (due ?? 0) > 0 },
          { href: "/flashcards", label: "Flashcards", icon: "🃏", badge: cardsDue ?? 0, live: (cardsDue ?? 0) > 0 },
          { href: "/mock", label: "Mock test", icon: "⏱️", live: true },
          { href: "/books", label: "Textbooks", icon: "📖", live: true },
          { href: "/aptitude", label: "Aptitude", icon: "🧮", live: true },
          { href: "/timeline", label: "Years", icon: "🗓️", live: true },
          { href: "/papers", label: "Past papers", icon: "📝", live: true },
          { href: "/ask", label: "Ask", icon: "💬", live: true },
          { href: "/offline", label: "Offline", icon: "📴" },
        ]}
      />
      <section className="relative overflow-hidden rounded-3xl bg-maroon-900 text-white shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/murugan/hero.webp" alt="முருகன்" className="absolute inset-y-0 right-0 h-full w-[58%] object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-r from-maroon-900 via-maroon-900/90 via-45% to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-maroon-900/80 to-transparent" />
        <div className="relative p-4 pr-[38%]">
          <p className="text-[12.5px] font-bold tracking-wide text-gold-400">{sloganOfDay()}</p>
          <Tilak className="mt-2 h-3.5 w-12" />
          <p className="mt-2 text-sm text-white/85">வணக்கம் சரண்யா 🙏</p>
          <p className="text-[11px] text-gold-400/90">இன்றைய திருநாமம்: {nameOfDay()}</p>
          <p className="text-xs text-white/60">{taDate(new Date(), true)}</p>
          <h1 className="mt-2 text-2xl font-bold">{EXAM_LABEL[exam]}</h1>
          {left != null && left >= 0 ? (
            <p className="mt-0.5 leading-tight"><span className="text-4xl font-bold text-gold-400">{left}</span> <span className="text-sm">நாட்கள்</span><br /><span className="text-xs text-white/70">{taDate(examDate!)}</span></p>
          ) : (
            <p className="mt-1 text-sm opacity-90"><Link href="/settings" className="underline">அமைப்புகளில்</Link> தேர்வு தேதியைச் சேர்க்கவும்</p>
          )}
        </div>
        <div className="relative px-4 pb-4">
          <div className="h-2 rounded-full bg-white/20"><div className="h-2 rounded-full bg-gradient-to-r from-gold-400 to-saffron-400" style={{ width: `${pct(doneTopics, topicCount)}%` }} /></div>
          <p className="mt-1 text-xs text-white/80">பாடத்திட்டம் {pct(doneTopics, topicCount)}% · {doneTopics}/{topicCount} தலைப்புகள்</p>
        </div>
      </section>

      <InstallApp />

      <AbodeJourney pct={pct(doneTopics, topicCount)} />

      <section className="card flex items-center justify-between gap-3">
        <div>
          <h2 className="h2">Today's practice {doneToday ? "✓" : ""}</h2>
          <p className="muted">20 questions: revision + weak units + current affairs · streak {streak} day{streak === 1 ? "" : "s"} 🔥</p>
        </div>
        <div className="shrink-0"><StartButton url="/api/daily" label={doneToday ? "Again" : "Start"} busyLabel="…" className="btn whitespace-nowrap" /></div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link href="/revision" className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-kumkum-500">{due ?? 0}</p>
          <p className="text-sm">Revision due today</p>
        </Link>
        <Link href={`/ca/${today}`} className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-brand-600">{caToday ?? 0}</p>
          <p className="text-sm">Today's current affairs</p>
        </Link>
        <Link href="/flashcards" className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-turmeric-500">{cardsDue ?? 0}</p>
          <p className="text-sm">Flashcards due</p>
        </Link>
        <Link href="/planner" className="card hover:border-brand-500">
          <p className="text-3xl font-bold text-ink">{mine.length}</p>
          <p className="text-sm">Tests this week · Plan →</p>
        </Link>
      </section>

      <section className="card">
        <h2 className="h2">Quick start</h2>
        <div className="mt-3 space-y-2">
          <StartButton url="/api/mock" body={{ exam }} label={`${EXAM_LABEL[exam]} full mock test`} busyLabel="Preparing paper…" className="btn w-full" />
          <div className="grid grid-cols-2 gap-2">
            {([
              ["/quiz/new", "Create quiz", "✚"],
              ["/books", "Textbooks", "📖"],
              ["/papers", "Previous papers", "📝"],
              ["/syllabus", "Unit quiz", "🎯"],
              ["/aptitude", "Aptitude", "🧮"],
              ["/ask", "Ask the textbook", "💬"],
              ["/offline", "Offline practice", "📴"],
              ["/revision", "Revision", "🔁"],
            ] as const).map(([href, label, icon]) => (
              <Link key={href} href={href} className="flex min-h-[64px] items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2.5 text-[15px] font-semibold leading-snug active:bg-brand-50">
                <span className="text-xl" aria-hidden>{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {board.length > 1 && (
        <section className="card">
          <h2 className="h2">This week (7 days)</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {board.map((b) => (
              <div key={b.name} className={`rounded-xl p-3 ${b.me ? "bg-brand-50" : "bg-stone-50"}`}>
                <p className="font-semibold">{b.name}</p>
                <p className="text-2xl font-bold">{b.acc}%</p>
                <p className="muted">{b.tests} tests</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section className="card">
          <h2 className="h2">Recent tests</h2>
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
