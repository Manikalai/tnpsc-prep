"use client";
import { useState } from "react";
import type { Explanation } from "@/app/api/explain/route";

export default function ExplainButton({ questionId, cached, offline }: { questionId: string; cached?: Explanation | null; offline?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ex, setEx] = useState<Explanation | null>(cached ?? null);
  if (!ex && offline) return <span className="text-xs text-stone-400">விரிவான விளக்கம்: இணையம் வந்ததும் கிடைக்கும்</span>;
  if (ex)
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-sm">
        <p><b className="text-brand-700">ஏன் இது சரி:</b> {ex.why_right}</p>
        {ex.options.length > 0 && (
          <div>
            <b className="text-kumkum-500">மற்ற விடைகள் ஏன் தவறு:</b>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{ex.options.map((o, k) => <li key={k}><span className="font-medium">{o.option}</span> — {o.why}</li>)}</ul>
          </div>
        )}
        {ex.tip && <p className="rounded-lg bg-turmeric-50 px-2 py-1"><b>நினைவில் வைக்க:</b> {ex.tip}</p>}
        {ex.related.length > 0 && (
          <div>
            <b>தொடர்புடைய உண்மைகள்:</b>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{ex.related.map((r, k) => <li key={k}>{r}</li>)}</ul>
          </div>
        )}
        {ex.source ? <p className="text-xs text-stone-500">ஆதாரம்: {ex.source}</p> : <p className="text-xs text-turmeric-500">⚠ பாடநூல் ஆதாரமின்றி எழுதப்பட்டது</p>}
      </div>
    );
  return (
    <span className="inline-flex flex-col">
      <button
        className="text-xs font-semibold text-brand-600 underline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          const r = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId }) });
          const d = await r.json().catch(() => ({}));
          if (r.ok) setEx(d);
          else setErr(d.error ?? "பிழை");
          setBusy(false);
        }}
      >
        {busy ? "விளக்கம் எழுதுகிறது…" : "விரிவாக விளக்கு"}
      </button>
      {err && <span className="text-xs text-kumkum-500">{err}</span>}
    </span>
  );
}
