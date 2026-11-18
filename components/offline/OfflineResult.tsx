"use client";
import { useEffect, useState } from "react";
import { idb } from "@/lib/offline-db";
import { OPT, pct } from "@/lib/format";
import type { Result } from "@/lib/offline-score";
import type { Explanation } from "@/app/api/explain/route";
import ExplainButton from "@/components/ExplainButton";

const DIFF: Record<string, string> = { easy: "எளிது", medium: "நடுத்தரம்", hard: "கடினம்" };

export default function OfflineResult({ result, online, onClose }: { result: Result; online: boolean; onClose: () => void }) {
  const [ex, setEx] = useState<Record<string, Explanation>>({});
  const wrong = result.review.filter((r) => r.chosen !== r.q.answer_index);
  useEffect(() => {
    (async () => {
      const m: Record<string, Explanation> = {};
      for (const r of wrong) {
        const e = await idb.getOne<{ content: Explanation }>("explanations", r.q.id);
        if (e) m[r.q.id] = e.content;
      }
      setEx(m);
    })();
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card space-y-3">
      <p className="muted">{result.title}</p>
      <p className="text-4xl font-bold text-brand-700">{result.marks}<span className="text-xl text-stone-400">/{result.max}</span></p>
      <p className="text-sm">சரி {result.correct}/{result.total} · {online ? "உங்கள் கணக்கில் சேர்க்கப்படுகிறது" : "இணையம் வந்ததும் உங்கள் கணக்கில் சேரும்"}</p>
      {result.gatePassed === false && <p className="rounded-xl bg-kumkum-50 p-3 text-sm text-kumkum-500">தமிழ்ப் பகுதியில் தகுதி மதிப்பெண் (60/150) கிடைக்கவில்லை.</p>}
      {result.parts.map((p) => <p key={p.name} className="flex justify-between text-sm"><span>{p.name}</span><b>{p.marks} ({p.correct}/{p.total})</b></p>)}
      {result.units.map((u) => (
        <div key={u.name} className="text-sm">
          <div className="flex justify-between"><span>{u.name}</span><span>{u.correct}/{u.total}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct(u.correct, u.total)}%` }} /></div>
        </div>
      ))}
      <details>
        <summary className="cursor-pointer font-semibold">தவறியவை / விடையில்லாதவை ({wrong.length})</summary>
        {wrong.map(({ q, chosen }) => (
          <div key={q.id} className="mt-3 border-t border-stone-100 pt-3 text-sm">
            <p className="text-xs text-stone-400">{q.difficulty ? DIFF[q.difficulty] ?? q.difficulty : ""}{q.verified === "ok" ? " · ✓ சரிபார்க்கப்பட்டது" : ""}</p>
            <p className="whitespace-pre-line font-medium">{q.stem}</p>
            {q.options.map((o, k) => <p key={k} className={k === q.answer_index ? "font-semibold text-brand-700" : chosen === k ? "text-kumkum-500 line-through" : ""}>{OPT[k]}) {o}</p>)}
            {q.explanation && <p className="mt-1 rounded bg-stone-50 p-2">{q.explanation}</p>}
            {q.source_ref && <p className="mt-1 text-xs text-stone-500">📖 {q.source_ref}</p>}
            <ExplainButton questionId={q.id} cached={ex[q.id] ?? null} offline={!online} />
          </div>
        ))}
      </details>
      <button className="btn-ghost btn-sm" onClick={onClose}>மூடு</button>
    </div>
  );
}
