"use client";
import { useState } from "react";

/** Question list where each answer is hidden until tapped — for quick self-testing. */
export default function RevealList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const all = Object.values(open).filter(Boolean).length === items.length;
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="h2">திருப்புதல் வினாக்கள் ({items.length})</h2>
        <button className="text-sm underline" onClick={() => setOpen(all ? {} : Object.fromEntries(items.map((_, k) => [k, true])))}>{all ? "Hide answers" : "Show all answers"}</button>
      </div>
      <ol className="space-y-2">
        {items.map((it, k) => (
          <li key={k} className="rounded-lg border border-stone-100 p-2">
            <button className="w-full text-left" onClick={() => setOpen({ ...open, [k]: !open[k] })}>
              <span className="font-medium">{k + 1}. {it.q}</span>
              {open[k] ? <span className="mt-1 block text-brand-700">➤ {it.a}</span> : <span className="mt-1 block text-xs text-stone-400">விடையைக் காண தொடவும்</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
