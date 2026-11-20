"use client";
import { toast } from "@/lib/toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OPT } from "@/lib/format";

type Q = { id: string; stem: string; options: string[]; unverified: boolean };

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};
const store = {
  get(k: string) { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* storage off */ } },
};

export default function TestRunner({ testId, title, durationSec, startedAt: startedAt0, questions, onSubmit, pausedLeft = null }: {
  testId: string; title: string; kind: string; durationSec: number; startedAt: string; questions: Q[];
  /** time left when the test was paused (online tests) */
  pausedLeft?: number | null;
  /** offline mode: handle the answers locally instead of posting to the server */
  onSubmit?: (r: { answers: Record<string, number | null>; times: Record<string, number>; elapsedSec: number }) => Promise<void>;
}) {
  const router = useRouter();
  const key = `test-${testId}`;
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [i, setI] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const times = useRef<Record<string, number>>({});
  const enteredAt = useRef(Date.now());
  const submitted = useRef(false);
  const [startedAt, setStartedAt] = useState(startedAt0);
  const [paused, setPaused] = useState<number | null>(pausedLeft); // seconds left while paused
  const pausedRef = useRef(paused); pausedRef.current = paused;

  useEffect(() => {
    const saved = store.get(key);
    if (saved) { setAnswers(saved.answers ?? {}); setFlags(saved.flags ?? {}); setI(saved.i ?? 0); times.current = saved.times ?? {}; }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [key]);
  useEffect(() => { store.set(key, { answers, flags, i, times: times.current }); }, [answers, flags, i, key]);

  const endAt = new Date(startedAt).getTime() + durationSec * 1000;
  const left = paused != null ? paused : Math.max(0, Math.round((endAt - now) / 1000));
  const leftRef = useRef(left); leftRef.current = left;
  const online = !onSubmit;
  const post = (action: string, extra: Record<string, unknown> = {}) =>
    fetch("/api/test/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, action, ...extra }) }).then((r) => r.json()).catch(() => ({}));

  const pause = () => { if (paused != null) return; setPaused(left); if (online) void post("pause", { left }); };
  const resume = async () => {
    if (paused == null) return;
    if (online) {
      const r = await post("resume");
      if (r.startedAt) setStartedAt(r.startedAt);
      else setStartedAt(new Date(Date.now() - (durationSec - paused) * 1000).toISOString());
    } else setStartedAt(new Date(Date.now() - (durationSec - paused) * 1000).toISOString());
    enteredAt.current = Date.now();
    setPaused(null);
  };
  const exitTest = async () => { if (paused == null && online) await post("pause", { left }); router.push("/"); };
  const discard = async () => {
    if (!window.confirm("இந்தத் தேர்வை நீக்கவா? இது மதிப்பெண்ணில் சேராது.")) return;
    submitted.current = true;
    store.del(key);
    if (online) await post("discard");
    router.replace("/");
  };
  // leaving the test (back, home, closing the app) pauses it, so the clock never runs while she is away
  useEffect(() => {
    if (!online) return;
    const away = () => {
      if (submitted.current || pausedRef.current != null) return;
      try { navigator.sendBeacon("/api/test/state", new Blob([JSON.stringify({ testId, action: "pause", left: leftRef.current })], { type: "application/json" })); } catch {}
    };
    window.addEventListener("pagehide", away);
    return () => { window.removeEventListener("pagehide", away); away(); };
  }, [online, testId]);
  const answered = useMemo(() => Object.values(answers).filter((v) => v != null).length, [answers]);

  const go = (n: number) => {
    const q = questions[i];
    if (q) times.current[q.id] = (times.current[q.id] ?? 0) + (Date.now() - enteredAt.current);
    enteredAt.current = Date.now();
    setI(Math.max(0, Math.min(questions.length - 1, n)));
    setShowPalette(false);
  };

  const submit = async (auto = false) => {
    if (submitted.current) return;
    if (!auto) {
      const left = questions.length - answered;
      if (left) {
        const first = questions.findIndex((q) => answers[q.id] == null);
        const proceed = window.confirm(
          `${left} வினாக்களில் எந்த விடையும் குறிக்கவில்லை.\n\nஉண்மைத் தேர்வில் ஒரு வினாவை விட்டாலும் விடைத்தாள் செல்லாது. தெரியாத வினாவுக்கு (E) விடை தெரியவில்லை என்பதைக் குறிக்கவும்.\n\n"சரி" = இப்போதே சமர்ப்பி · "ரத்து" = வினா ${first + 1}-க்குச் செல்`
        );
        if (!proceed) { go(first); return; }
      } else if (!window.confirm("தேர்வைச் சமர்ப்பிக்கவா?")) return;
    }
    submitted.current = true;
    setBusy(true);
    go(i);
    const elapsedSec = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
    if (onSubmit) {
      await onSubmit({ answers, times: times.current, elapsedSec });
      store.del(key);
      return;
    }
    const res = await fetch("/api/test/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, answers, times: times.current, elapsedSec: Math.round((Date.now() - new Date(startedAt).getTime()) / 1000) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { store.del(key); router.replace(data.redirect); }
    else { submitted.current = false; setBusy(false); toast(data.error ?? "சமர்ப்பிக்க முடியவில்லை — இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும். உங்கள் விடைகள் சேமிக்கப்பட்டுள்ளன."); }
  };

  useEffect(() => { if (left === 0 && paused == null && questions.length && !submitted.current) submit(true); }); // eslint-disable-line react-hooks/exhaustive-deps

  const q = questions[i];
  if (!q) return <p className="card">இந்தத் தேர்வில் வினாக்கள் இல்லை.</p>;
  const chosen = answers[q.id];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between gap-2 border-b border-stone-200 bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-700">{title}</p>
          <p className="text-xs text-stone-500">விடையளித்தவை {answered}/{questions.length}</p>
        </div>
        <button onClick={pause} aria-label="Pause" className={`flex items-center gap-1 rounded-lg px-3 py-1 font-mono text-sm font-bold active:scale-95 ${left < 300 ? "bg-kumkum-50 text-kumkum-500" : "bg-white text-ink"}`}>⏸ {fmtTime(left)}</button>
        <button className="btn btn-sm" onClick={() => submit()} disabled={busy}>{busy ? "…" : "Submit"}</button>
      </div>
      {paused != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-4xl">⏸</p>
            <p className="text-lg font-bold">தேர்வு இடைநிறுத்தப்பட்டது</p>
            <p className="text-sm text-stone-600">மீதமுள்ள நேரம் <b className="font-mono">{fmtTime(paused)}</b> · விடையளித்தவை {answered}/{questions.length}</p>
            <button onClick={resume} className="btn w-full !py-3">▶ Resume</button>
            {online && <button onClick={exitTest} className="btn-ghost w-full">Save &amp; exit (resume later)</button>}
            {online && <button onClick={discard} className="w-full rounded-xl py-2 text-sm font-semibold text-kumkum-500 active:bg-kumkum-50">Discard this test</button>}
          </div>
        </div>
      )}
      {!onSubmit && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">Print / offline:</span>
          <a href={`/test/${testId}/print?part=paper&auto=1`} className="chip !py-1">📄 Question paper PDF</a>
          <a href={`/test/${testId}/print?part=key&auto=1`} className="chip !py-1">🔑 Answer key PDF</a>
        </div>
      )}

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <span className="chip">வினா {i + 1} / {questions.length}</span>
          <button className={`text-sm ${flags[q.id] ? "font-bold text-turmeric-500" : "text-stone-500"}`} onClick={() => setFlags({ ...flags, [q.id]: !flags[q.id] })}>
            {flags[q.id] ? "★ மீண்டும் பார்க்க" : "☆ மீண்டும் பார்க்க"}
          </button>
        </div>
        <p className="whitespace-pre-line text-[17px] font-medium leading-relaxed">{q.stem}</p>
        {q.unverified && <p className="mt-1 text-xs text-turmeric-500">⚠ பாடநூல் ஆதாரம் இணைக்கப்படாத AI வினா</p>}
        <div className="mt-4 space-y-2">
          {q.options.map((o, k) => (
            <button
              key={k}
              onClick={() => setAnswers({ ...answers, [q.id]: chosen === k ? null : k })}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${chosen === k ? "border-brand-500 bg-brand-50" : "border-stone-200 bg-white hover:bg-stone-50"}`}
            >
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${chosen === k ? "bg-brand-500 text-white" : "bg-stone-100"}`}>{OPT[k]}</span>
              <span className="whitespace-pre-line">{o}</span>
            </button>
          ))}
          <button
            onClick={() => setAnswers({ ...answers, [q.id]: chosen === 4 ? null : 4 })}
            className={`flex w-full items-start gap-3 rounded-xl border border-dashed px-3 py-2.5 text-left text-sm transition ${chosen === 4 ? "border-stone-500 bg-stone-100" : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"}`}
          >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${chosen === 4 ? "bg-stone-500 text-white" : "bg-stone-100"}`}>உ</span>
            <span>(E) விடை தெரியவில்லை</span>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => go(i - 1)} disabled={i === 0}>← Prev</button>
        <button className="btn-ghost" onClick={() => setShowPalette(!showPalette)}>Question grid</button>
        <button className="btn-ghost" onClick={() => go(i + 1)} disabled={i === questions.length - 1}>Next →</button>
      </div>

      {showPalette && (
        <div className="card mt-3">
          <div className="mb-2 flex flex-wrap gap-3 text-xs text-stone-500">
            <span><span className="inline-block h-3 w-3 rounded bg-brand-500" /> விடையளித்தது</span>
            <span><span className="inline-block h-3 w-3 rounded bg-turmeric-500" /> மீண்டும் பார்க்க</span>
            <span><span className="inline-block h-3 w-3 rounded bg-stone-400" /> (E) தெரியவில்லை</span>
            <span><span className="inline-block h-3 w-3 rounded border border-kumkum-500" /> குறிக்கவில்லை</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {questions.map((qq, n) => (
              <button
                key={qq.id}
                onClick={() => go(n)}
                className={`h-9 rounded-lg text-sm font-semibold ${n === i ? "ring-2 ring-ink" : ""} ${flags[qq.id] ? "bg-turmeric-500 text-white" : answers[qq.id] === 4 ? "bg-stone-400 text-white" : answers[qq.id] != null ? "bg-brand-500 text-white" : "border border-kumkum-500 bg-white"}`}
              >
                {n + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
