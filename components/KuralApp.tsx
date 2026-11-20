"use client";
// திருக்குறள்: read by அதிகாரம், and quizzes built straight from the kural text (no AI, so every answer is exact).
import { useEffect, useMemo, useState } from "react";

type Ch = { n: number; name: string; paal: string; s: number; e: number };
type Data = { ch: Ch[]; k: [string, string][] };
type Q = { stem: string; lines?: [string, string]; options: string[]; answer: number; note: string };

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function shuffle<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const words = (l: string) => l.replace(/[.,;!?]/g, "").split(/\s+/).filter(Boolean);

function makeQuiz(d: Data, chapters: Ch[], n = 10): Q[] {
  const chOf = (i: number) => d.ch.find((c) => i + 1 >= c.s && i + 1 <= c.e)!;
  const pool = chapters.flatMap((c) => Array.from({ length: c.e - c.s + 1 }, (_, j) => c.s - 1 + j));
  const out: Q[] = [];
  for (let t = 0; out.length < n && t < n * 6; t++) {
    const i = rnd(pool), [l1, l2] = d.k[i], c = chOf(i), type = t % 4;
    const note = `குறள் ${i + 1} · ${c.name} (${c.paal})`;
    if (type === 0) {
      // which அதிகாரம்
      const others = shuffle(d.ch.filter((x) => x.n !== c.n && x.paal === c.paal)).slice(0, 3).map((x) => x.name);
      const opts = shuffle([c.name, ...others]);
      out.push({ stem: "இக்குறள் இடம்பெறும் அதிகாரம் எது?", lines: [l1, l2], options: opts, answer: opts.indexOf(c.name), note });
    } else if (type === 1) {
      // complete the second line
      const same = shuffle(Array.from({ length: c.e - c.s + 1 }, (_, j) => c.s - 1 + j).filter((x) => x !== i)).slice(0, 3).map((x) => d.k[x][1]);
      const opts = shuffle([l2, ...same]);
      out.push({ stem: "குறளின் இரண்டாம் அடியைத் தேர்ந்தெடுக்க:", lines: [l1, "…"], options: opts, answer: opts.indexOf(l2), note });
    } else if (type === 2) {
      // fill the missing word
      const w = words(l1).filter((x) => x.length >= 3);
      if (!w.length) continue;
      const pick = rnd(w);
      const other = shuffle(d.k.filter((_, x) => x !== i).flatMap(([a]) => words(a)).filter((x) => x.length >= 3 && x !== pick)).slice(0, 3);
      if (other.length < 3) continue;
      const opts = shuffle([pick, ...other]);
      out.push({ stem: "விடுபட்ட சொல்லை நிரப்புக:", lines: [l1.replace(pick, "______"), l2], options: opts, answer: opts.indexOf(pick), note });
    } else {
      // which பால்
      const paals = ["அறத்துப்பால்", "பொருட்பால்", "காமத்துப்பால்"];
      const opts = [...paals, "இவற்றில் எதுவுமில்லை"];
      out.push({ stem: `"${c.name}" அதிகாரம் இடம்பெறும் பால் எது?`, options: opts, answer: opts.indexOf(c.paal), note: `அதிகாரம் ${c.n} · ${c.name}` });
    }
  }
  return out;
}

export default function KuralApp() {
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"read" | "quiz" | "facts">("read");
  const [chN, setChN] = useState(1);
  const [scope, setScope] = useState<"all" | "அறத்துப்பால்" | "பொருட்பால்" | "காமத்துப்பால்">("all");
  const [quiz, setQuiz] = useState<Q[]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});

  useEffect(() => { fetch("/data/kural.json").then((r) => r.json()).then(setD).catch(() => {}); }, []);
  const scopeCh = useMemo(() => (d ? d.ch.filter((c) => scope === "all" || c.paal === scope) : []), [d, scope]);
  const start = () => { if (d) { setQuiz(makeQuiz(d, scopeCh)); setPicked({}); } };
  useEffect(() => { if (d && tab === "quiz" && !quiz.length) start(); }, [d, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <p className="muted py-10 text-center">திருக்குறள் ஏற்றுகிறது…</p>;
  const ch = d.ch.find((c) => c.n === chN)!;
  const done = Object.keys(picked).length, score = quiz.filter((q, i) => picked[i] === q.answer).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["read", "Read"], ["quiz", "Quiz"], ["facts", "Facts"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${tab === k ? "bg-gradient-to-r from-maroon-600 to-saffron-500 text-white shadow-md" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>

      {tab === "read" && (
        <>
          <select className="input" value={chN} onChange={(e) => setChN(Number(e.target.value))}>
            {d.ch.map((c) => <option key={c.n} value={c.n}>{c.n}. {c.name} — {c.paal}</option>)}
          </select>
          <div className="flex items-center justify-between">
            <button className="pill-nav" disabled={chN === 1} onClick={() => setChN(chN - 1)}>‹ Prev</button>
            <span className="text-sm text-stone-500">குறள் {ch.s}–{ch.e}</span>
            <button className="pill-nav" disabled={chN === 133} onClick={() => setChN(chN + 1)}>Next ›</button>
          </div>
          <div className="space-y-2.5">
            {d.k.slice(ch.s - 1, ch.e).map(([a, b], j) => (
              <div key={j} className="card reading">
                <p className="text-xs font-semibold text-saffron-500">குறள் {ch.s + j}</p>
                <p className="mt-1 font-[family-name:var(--font-read)] text-[17px] leading-[1.9]">{a}<br />{b}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "quiz" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "அறத்துப்பால்", "பொருட்பால்", "காமத்துப்பால்"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={`chip !px-3 !py-1 !text-[13px] ${scope === s ? "!bg-maroon-600 !text-white" : ""}`}>{s === "all" ? "All" : s}</button>
            ))}
            <button className="btn btn-sm ml-auto" onClick={start}>New 10</button>
          </div>
          {quiz.map((q, i) => (
            <div key={i} className="card space-y-2">
              <p className="font-semibold">{i + 1}. {q.stem}</p>
              {q.lines && <p className="rounded-xl bg-amber-50 px-3 py-2 font-[family-name:var(--font-read)] text-[16px] leading-[1.9]">{q.lines[0]}<br />{q.lines[1]}</p>}
              <div className="grid gap-2">
                {q.options.map((o, j) => {
                  const p = picked[i], shown = p !== undefined;
                  const cls = !shown ? "bg-white ring-1 ring-stone-200 active:bg-stone-50" : j === q.answer ? "bg-emerald-50 ring-2 ring-emerald-500" : j === p ? "bg-rose-50 ring-2 ring-rose-400" : "bg-white ring-1 ring-stone-200 opacity-70";
                  return (
                    <button key={j} disabled={shown} onClick={() => setPicked({ ...picked, [i]: j })} className={`rounded-xl px-3 py-2.5 text-left text-[15px] transition ${cls}`}>
                      {"அஆஇஈ"[j]}) {o}
                    </button>
                  );
                })}
              </div>
              {picked[i] !== undefined && <p className="text-[13px] text-stone-500">{picked[i] === q.answer ? "✓ சரி" : "✗"} · {q.note}</p>}
            </div>
          ))}
          {quiz.length > 0 && done === quiz.length && (
            <div className="card text-center">
              <p className="text-3xl font-bold text-maroon-700">{score}/{quiz.length}</p>
              <p className="muted">{score >= 8 ? "வெற்றி வேல்! அருமை சரண்யா" : "இன்னும் ஒரு முறை — கந்தன் துணை"}</p>
              <button className="btn mt-3" onClick={start}>New 10</button>
            </div>
          )}
        </>
      )}

      {tab === "facts" && (
        <div className="card prose-ta">
          <ul>
            <li>மொத்தக் குறள்கள்: <strong>{d.k.length}</strong> · அதிகாரங்கள்: <strong>{d.ch.length}</strong> (ஒவ்வொன்றிலும் 10 குறள்கள்)</li>
            {["அறத்துப்பால்", "பொருட்பால்", "காமத்துப்பால்"].map((p) => {
              const cs = d.ch.filter((c) => c.paal === p);
              return <li key={p}><strong>{p}</strong>: அதிகாரங்கள் {cs[0].n}–{cs[cs.length - 1].n} ({cs.length}) · குறள்கள் {cs[0].s}–{cs[cs.length - 1].e}</li>;
            })}
            <li>முதல் அதிகாரம்: <strong>{d.ch[0].name}</strong> · இறுதி அதிகாரம்: <strong>{d.ch[132].name}</strong></li>
          </ul>
          <p className="muted">திருக்குறள் பற்றிய பிற தகவல்கள் (வேறு பெயர்கள், உரையாசிரியர்கள்) உங்கள் தமிழ்ப் பாடநூலில் உள்ளபடி "Tamil lessons" பகுதியில் படிக்கவும்.</p>
        </div>
      )}
    </div>
  );
}
