"use client";
// Book-back (end-of-lesson) questions with answers and explanations; answers hidden until tapped.
import { useState } from "react";
import type { BookBack } from "@/lib/bookback";

const L = ["அ", "ஆ", "இ", "ஈ"];

export function BookBackView({ data }: { data: BookBack }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const keys = data.sections.flatMap((s, i) => s.items.map((_, j) => `${i}-${j}`));
  const all = keys.length > 0 && keys.every((k) => open[k]);
  if (!data.found || !data.sections.length) return <p className="card text-sm">இந்தப் பாடத்தில் புத்தகப் பயிற்சி வினாக்கள் கண்டறியப்படவில்லை.</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-ghost btn-sm" onClick={() => setOpen(all ? {} : Object.fromEntries(keys.map((k) => [k, true])))}>{all ? "விடைகளை மறை" : "எல்லா விடைகளும் காட்டு"}</button>
      </div>
      {data.sections.map((s, i) => (
        <section key={i} className="card">
          <h2 className="mb-2 text-[17px] font-bold text-maroon-700">{s.title}</h2>
          <ol className="space-y-2.5">
            {s.items.map((it, j) => {
              const k = `${i}-${j}`;
              return (
                <li key={k} className="rounded-xl border border-stone-200/80 p-3">
                  <p className="whitespace-pre-line font-medium leading-relaxed">{j + 1}. {it.q}</p>
                  {it.options?.length ? (
                    <ul className="mt-1.5 grid gap-1 text-[15px]">
                      {it.options.map((o, n) => (
                        <li key={n} className={`rounded-lg px-2 py-1 ${open[k] && it.answer_index === n ? "bg-brand-50 font-semibold text-brand-700" : ""}`}>({L[n] ?? n + 1}) {o}</li>
                      ))}
                    </ul>
                  ) : null}
                  {open[k] ? (
                    <div className="mt-2 rounded-lg bg-gold-400/10 p-2.5 text-[15px]">
                      <p><b className="text-brand-700">விடை:</b> {it.answer}</p>
                      {it.explanation && <p className="mt-1 text-stone-700"><b>விளக்கம்:</b> {it.explanation}</p>}
                      {it.page ? <p className="mt-1 text-xs text-stone-500">பாடநூல் பக். {it.page}</p> : null}
                    </div>
                  ) : (
                    <button className="mt-2 text-sm font-semibold text-brand-600 underline" onClick={() => setOpen({ ...open, [k]: true })}>விடை & விளக்கம் காட்டு</button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function BookBackPanel({ chapterId, initial }: { chapterId: number; initial: BookBack | null }) {
  const [data, setData] = useState<BookBack | null>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (data) return <BookBackView data={data} />;
  return (
    <div className="card space-y-2 text-center">
      <p className="text-sm text-stone-600">இந்தப் பாடத்தின் புத்தக வினாக்கள் இன்னும் தயாராகவில்லை (இரவுப் பணி படிப்படியாக எல்லாப் பாடங்களுக்கும் தயாரிக்கும்).</p>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const r = await fetch("/api/chapter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bookback", chapterId }) });
            const d = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
            if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
            setData(d);
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "புத்தக வினாக்களுக்கு விடை எழுதுகிறது… (1 நிமிடம் வரை)" : "இப்போதே தயாரி"}
      </button>
      {err && <p className="text-sm text-red-700">{err}{/timeout|504|HTTP 5/i.test(err) ? " — நீண்ட பாடம்; இரவுப் பணி தயாரிக்கும்." : ""}</p>}
    </div>
  );
}
