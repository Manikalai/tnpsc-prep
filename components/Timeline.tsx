"use client";
// Years & events across all subjects: one timeline with eras and anchor years, "same year" links, and a computed quiz.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ANCHORS, ERAS, fmtYear, nearestAnchor, yearHook, type TEvent } from "@/lib/timeline";
import AddCards from "@/components/AddCards";

const SUBJ: Record<string, string> = { history: "வரலாறு", civics: "குடிமையியல்", geography: "புவியியல்", economics: "பொருளியல்", physics: "இயற்பியல்", chemistry: "வேதியியல்", biology: "உயிரியல்", tamil: "தமிழ்", social: "சமூக அறிவியல்", science: "அறிவியல்" };
const label = (e: TEvent) => SUBJ[e.section ?? ""] ?? SUBJ[e.subject] ?? e.subject;
const COLORS: Record<string, string> = { வரலாறு: "bg-maroon-500/10 text-maroon-700", தமிழ்: "bg-gold-400/25 text-maroon-700", அறிவியல்: "bg-brand-50 text-brand-700", இயற்பியல்: "bg-brand-50 text-brand-700", வேதியியல்: "bg-brand-50 text-brand-700", உயிரியல்: "bg-brand-50 text-brand-700" };
const chip = (s: string) => COLORS[s] ?? "bg-stone-100 text-stone-700";
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export default function Timeline({ events }: { events: TEvent[] }) {
  const [tab, setTab] = useState<"line" | "same" | "quiz" | "tips">("line");
  const [subject, setSubject] = useState<string>("all");
  const subjects = useMemo(() => [...new Set(events.map(label))], [events]);
  const list = useMemo(() => (subject === "all" ? events : events.filter((e) => label(e) === subject)), [events, subject]);

  if (!events.length)
    return (
      <div className="card space-y-2 text-sm">
        <p className="font-semibold">ஆண்டுகள் இன்னும் சேர்க்கப்படவில்லை.</p>
        <p className="text-stone-600">ஒவ்வொரு பாடத்தின் “நாட்கள் · ஆளுமைகள்” குறிப்புகள் தயாராகும்போது அவற்றின் ஆண்டுகள் இங்கே தானாகச் சேரும் (இரவுப் பணி).</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="card">
        <p className="text-[15px]"><b className="text-maroon-700">{events.length}</b> நிகழ்வுகள் · எல்லாப் பாடங்களிலிருந்தும் · காலவரிசைப்படி</p>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
          {["all", ...subjects].map((s) => (
            <button key={s} onClick={() => setSubject(s)} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${subject === s ? "bg-maroon-500 text-white" : "bg-stone-100"}`}>{s === "all" ? "எல்லாம்" : s}</button>
          ))}
        </div>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {([["line", "Timeline"], ["same", "Same year"], ["quiz", "Quiz"], ["tips", "Memory tricks"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>
      {tab === "line" && <Line list={list} />}
      {tab === "same" && <Same list={list} />}
      {tab === "quiz" && <Quiz list={list} />}
      {tab === "tips" && <Tips />}
    </div>
  );
}

function Line({ list }: { list: TEvent[] }) {
  return (
    <div className="space-y-4">
      {ERAS.map((era) => {
        const ev = list.filter((e) => e.year >= era.from && e.year <= era.to);
        if (!ev.length) return null;
        const anchors = ANCHORS.filter(([y]) => y >= era.from && y <= era.to);
        return (
          <section key={era.name} className="card">
            <h2 className="mb-2 text-[16px] font-bold text-maroon-700">{era.name} <span className="text-xs font-normal text-stone-500">· {ev.length}</span></h2>
            {anchors.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">{anchors.map(([y, t]) => <span key={y} className="chip bg-gold-400/25 text-maroon-700">⚓ {y} {t}</span>)}</div>
            )}
            <ol className="relative ml-2 border-l-2 border-saffron-400/60">
              {ev.map((e, i) => {
                const near = nearestAnchor(e.year);
                return (
                  <li key={i} className="relative pb-3 pl-4">
                    <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-saffron-500 ring-2 ring-white" />
                    <p className="font-bold text-brand-700">{e.label}{e.approx ? " (ஏறத்தாழ)" : ""}</p>
                    <p className="text-[15px] leading-snug">{e.event}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`chip ${chip(label(e))}`}>{label(e)}</span>
                      <Link href={`/chapter/${e.chapterId}?tab=facts`} className="text-xs text-stone-500 underline">{e.lesson}</Link>
                    </div>
                    {near && !near.text.startsWith(String(e.year) + " —") && <p className="mt-0.5 text-xs text-maroon-500">⚓ {near.text}</p>}
                    {!e.approx && <p className="mt-0.5 text-xs text-stone-500">🧠 {yearHook(e.year)}</p>}
                  </li>
                );
              })}
            </ol>
            <AddCards cards={ev.map((e) => ({ front: `${e.event} — எந்த ஆண்டு?`, back: `${e.label} (${e.lesson})` }))} label="Add this era as flashcards" />
          </section>
        );
      })}
    </div>
  );
}

function Same({ list }: { list: TEvent[] }) {
  const groups = useMemo(() => {
    const m = new Map<number, TEvent[]>();
    for (const e of list) if (!e.approx) m.set(e.year, [...(m.get(e.year) ?? []), e]);
    return [...m.entries()].filter(([, v]) => v.length > 1 && new Set(v.map((x) => x.chapterId)).size > 1).sort((a, b) => a[0] - b[0]);
  }, [list]);
  if (!groups.length) return <p className="card text-sm">பல பாடங்களில் ஒரே ஆண்டில் வரும் நிகழ்வுகள் இன்னும் இல்லை.</p>;
  return (
    <div className="space-y-3">
      <p className="muted">ஒரே ஆண்டில் வேறு வேறு பாடங்களில் வரும் நிகழ்வுகள் — ஒன்றை நினைத்தால் மற்றொன்றும் நினைவுக்கு வரும்.</p>
      {groups.map(([y, v]) => (
        <section key={y} className="card">
          <p className="text-2xl font-bold text-maroon-700">{fmtYear(y)}</p>
          <ul className="mt-1 divide-y divide-stone-100">
            {v.map((e, i) => (
              <li key={i} className="py-2"><span className={`chip mr-1.5 ${chip(label(e))}`}>{label(e)}</span>{e.event}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type Q = { q: string; options: string[]; answer: number; why: string };
function makeQuiz(list: TEvent[], n = 10): Q[] {
  const exact = list.filter((e) => !e.approx);
  const years = [...new Set(exact.map((e) => e.year))];
  if (exact.length < 4 || years.length < 4) return [];
  const out: Q[] = [];
  for (const e of shuffle(exact)) {
    if (out.length >= n) break;
    if (Math.random() < 0.6) {
      // which year?
      const near = shuffle(years.filter((y) => y !== e.year)).sort((a, b) => Math.abs(a - e.year) - Math.abs(b - e.year)).slice(0, 3);
      if (near.length < 3) continue;
      const opts = shuffle([e.year, ...near]);
      out.push({ q: `“${e.event}” — எந்த ஆண்டு?`, options: opts.map(fmtYear), answer: opts.indexOf(e.year), why: `${e.label} · ${e.lesson}` });
    } else {
      // which came first?
      const others = shuffle(exact.filter((x) => x.year !== e.year)).filter((x, i, a) => a.findIndex((z) => z.year === x.year) === i).slice(0, 3);
      if (others.length < 3) continue;
      const four = shuffle([e, ...others]);
      const first = four.reduce((a, b) => (b.year < a.year ? b : a));
      out.push({ q: "இவற்றில் முதலில் நடந்தது எது?", options: four.map((x) => x.event), answer: four.indexOf(first), why: four.map((x) => `${fmtYear(x.year)}: ${x.event}`).sort().join(" · ") });
    }
  }
  return out;
}

function Quiz({ list }: { list: TEvent[] }) {
  const [qs, setQs] = useState<Q[]>(() => makeQuiz(list));
  const [ans, setAns] = useState<Record<number, number>>({});
  if (!qs.length) return <p className="card text-sm">வினாடி வினாவுக்குப் போதுமான ஆண்டுகள் இல்லை (குறைந்தது 4 வேறு ஆண்டுகள் வேண்டும்).</p>;
  const score = qs.filter((q, i) => ans[i] === q.answer).length;
  return (
    <div className="space-y-3">
      {qs.map((q, i) => (
        <div key={i} className="card">
          <p className="font-medium">{i + 1}. {q.q}</p>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((o, j) => {
              const picked = ans[i] === j, done = ans[i] != null;
              const cls = done ? (j === q.answer ? "border-brand-500 bg-brand-50" : picked ? "border-kumkum-500 bg-kumkum-50" : "border-stone-200") : "border-stone-200 active:bg-stone-50";
              return <button key={j} disabled={done} onClick={() => setAns({ ...ans, [i]: j })} className={`rounded-xl border px-3 py-2 text-left text-[15px] ${cls}`}>{o}</button>;
            })}
          </div>
          {ans[i] != null && <p className="mt-2 text-[13px] text-stone-600">{q.why}</p>}
        </div>
      ))}
      <div className="card flex items-center justify-between">
        <b className="text-maroon-700">{score}/{qs.length}</b>
        <button className="btn" onClick={() => { setQs(makeQuiz(list)); setAns({}); }}>New 10 questions</button>
      </div>
    </div>
  );
}

function Tips() {
  const tips: [string, string][] = [
    ["⚓ நங்கூர ஆண்டுகள்", "1757, 1857, 1885, 1905, 1919, 1930, 1942, 1947, 1950 — இவற்றை முதலில் உறுதியாக நினைவில் வையுங்கள். மற்ற ஆண்டுகளை “1947-க்கு 2 ஆண்டு முன்” என இவற்றோடு இணைத்து நினைவு கொள்ளுங்கள் (காலவரிசையில் ஒவ்வொரு நிகழ்வுக்கும் இது காட்டப்படும்)."],
    ["🧵 கதைச் சங்கிலி", "ஒரு காலப்பகுதியின் 5–6 நிகழ்வுகளை காரணம் → விளைவு என ஒரு சிறு கதையாகச் சொல்லுங்கள் (வங்கப் பிரிவினை 1905 → சுதேசி இயக்கம் → வ.உ.சி. கப்பல் 1906)."],
    ["🔢 இலக்க வடிவம்", "ஆண்டின் கடைசி இரு இலக்கங்களுக்கு ஒரு படம்/வடிவம் கொடுங்கள் (…42 = வெள்ளையனே வெளியேறு; …19 = ஜாலியன்வாலா). ஒரே இலக்கம் வரும் ஆண்டுகளை ஒப்பிடுங்கள் (1919 / 1819)."],
    ["🧭 நூற்றாண்டு விதி", "n-ஆம் நூற்றாண்டு = (n−1)01 முதல் n00 வரை: 19ஆம் நூற்றாண்டு = 1801–1900. கி.மு.வில் எண் பெரியது = மிகப் பழையது."],
    ["🔗 ஒரே ஆண்டு இணைப்பு", "“ஒரே ஆண்டு” பகுதியில் வெவ்வேறு பாடங்களின் நிகழ்வுகள் ஒரே ஆண்டில் வருவதைப் பாருங்கள் — ஒன்று மற்றொன்றை நினைவூட்டும்."],
    ["🔁 இடைவெளித் திருப்புதல்", "ஒவ்வொரு காலப்பகுதியையும் அட்டைகளாகச் சேர்த்து 1, 3, 7, 15 நாள் இடைவெளியில் திருப்புங்கள்; வாரம் ஒருமுறை இங்குள்ள வினாடி வினாவைச் செய்யுங்கள்."],
  ];
  return (
    <div className="space-y-2">
      {tips.map(([t, d]) => (
        <section key={t} className="card"><p className="font-bold text-maroon-700">{t}</p><p className="mt-1 text-[15px] leading-relaxed">{d}</p></section>
      ))}
    </div>
  );
}
