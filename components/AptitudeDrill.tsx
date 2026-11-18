"use client";
import { useEffect, useState } from "react";
import { drill, type AptQ } from "@/lib/aptitude";
import { OPT } from "@/lib/format";

export default function AptitudeDrill({ keys, n, title, seconds }: { keys: string[]; n: number; title: string; seconds: number }) {
  const [qs, setQs] = useState<(AptQ & { type: string })[] | null>(null);
  const [ans, setAns] = useState<Record<number, number>>({});
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!qs || done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [qs, done]);

  const left = qs ? Math.max(0, seconds - Math.round((now - start) / 1000)) : seconds;
  const finish = async () => {
    if (!qs || done) return;
    setDone(true);
    const correct = qs.filter((q, k) => ans[k] === q.answer_index).length;
    await fetch("/api/aptitude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, correct, total: qs.length, seconds: Math.round((Date.now() - start) / 1000), types: keys }) });
  };
  useEffect(() => { if (qs && left === 0 && !done) finish(); }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!qs)
    return (
      <div className="card flex items-center justify-between gap-2">
        <div><p className="font-semibold">{title}</p><p className="muted">நேரம் {Math.round(seconds / 60)} நிமிடம்</p></div>
        <button className="btn" onClick={() => { setQs(drill(keys, n)); setAns({}); setDone(false); setStart(Date.now()); setNow(Date.now()); }}>தொடங்கு</button>
      </div>
    );

  const correct = qs.filter((q, k) => ans[k] === q.answer_index).length;
  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-10 flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
        <span className="text-sm font-semibold">{title}</span>
        {done ? <b className="text-brand-700">{correct}/{qs.length}</b> : <span className="font-mono">⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
      </div>
      {qs.map((q, k) => (
        <div key={k} className="card">
          <p className="font-medium">{k + 1}. {q.stem}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {q.options.map((o, j) => {
              const picked = ans[k] === j, right = j === q.answer_index;
              const cls = done ? (right ? "border-brand-500 bg-brand-50" : picked ? "border-kumkum-500 bg-kumkum-50" : "border-stone-200") : picked ? "border-brand-500 bg-brand-50" : "border-stone-200";
              return (
                <button key={j} disabled={done} onClick={() => setAns({ ...ans, [k]: j })} className={`rounded-xl border px-3 py-2 text-left ${cls}`}>
                  {OPT[j]}) {o}
                </button>
              );
            })}
          </div>
          {done && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">{q.explanation}</p>}
        </div>
      ))}
      {!done ? (
        <button className="btn w-full" onClick={finish}>முடி</button>
      ) : (
        <button className="btn w-full" onClick={() => { setQs(drill(keys, n)); setAns({}); setDone(false); setStart(Date.now()); setNow(Date.now()); window.scrollTo(0, 0); }}>புதிய வினாக்கள்</button>
      )}
    </div>
  );
}
