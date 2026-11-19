"use client";
// Real TNPSC questions for a topic: answer and explanation hidden until tapped.
import { useState } from "react";
import ExplainButton from "@/components/ExplainButton";
import { OPT } from "@/lib/format";

type Q = { id: string; stem: string; options: string[]; answer_index: number; explanation: string | null; exam_code: string | null; pyq_year: number | null };
const EXAM: Record<string, string> = { G4: "குரூப் 4", G2: "குரூப் 2/2A", G1: "குரூப் 1" };

export default function PyqReveal({ items }: { items: Q[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <ol className="space-y-3">
      {items.map((q, k) => (
        <li key={q.id} className="card">
          <div className="mb-1 flex items-center gap-2">
            <span className="chip bg-maroon-500/10 text-maroon-700">{EXAM[q.exam_code ?? ""] ?? q.exam_code} – {q.pyq_year ?? "?"}</span>
          </div>
          <p className="whitespace-pre-line font-medium">{k + 1}. {q.stem}</p>
          <ul className="mt-2 grid gap-1 text-[15px]">
            {q.options.map((o, j) => (
              <li key={j} className={`rounded-lg px-2 py-1 ${open[q.id] && j === q.answer_index ? "bg-brand-50 font-semibold text-brand-700" : ""}`}>({OPT[j]}) {o}</li>
            ))}
          </ul>
          {open[q.id] ? (
            <div className="mt-2 space-y-2">
              <p className="rounded-lg bg-gold-400/10 p-2 text-[15px]"><b className="text-brand-700">விடை:</b> ({OPT[q.answer_index]}) {q.options[q.answer_index]} <span className="text-xs text-stone-500">— TNPSC அதிகாரபூர்வ விடைக்குறிப்பு</span>{q.explanation ? <><br />{q.explanation}</> : null}</p>
              <ExplainButton questionId={q.id} />
            </div>
          ) : (
            <button className="mt-2 text-sm font-semibold text-brand-600 underline" onClick={() => setOpen({ ...open, [q.id]: true })}>விடை காட்டு</button>
          )}
        </li>
      ))}
    </ol>
  );
}
