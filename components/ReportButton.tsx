"use client";
// ⚑ Report a mistake: one tap, pick a reason. Questions are held back for review right away;
// note reports go to the review list in Question bank.
import { useState } from "react";
import { IconFlag } from "@tabler/icons-react";
import { toast } from "@/lib/toast";

const REASONS = ["தவறான விடை", "தமிழ் உடைந்துள்ளது", "வினா புரியவில்லை", "வேறு"];

export default function ReportButton({ questionId, chapterId, kind, small }: { questionId?: string; chapterId?: number; kind?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [text, setText] = useState("");
  const send = async (reason: string) => {
    setOpen(false); setDone(true);
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, chapterId, kind, reason: text ? `${reason}: ${text}` : reason }) });
      if (!r.ok) throw new Error();
      toast("நன்றி சரண்யா — சரிபார்க்கப்படும் 🙏");
    } catch { setDone(false); toast("அனுப்ப முடியவில்லை — மீண்டும் முயலவும்"); }
  };
  if (done) return <span className={`inline-flex items-center gap-1 text-xs text-emerald-600 ${small ? "" : "py-1"}`}><IconFlag size={14} /> Reported</span>;
  return (
    <span className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-stone-400 active:bg-stone-100" aria-label="Report a mistake">
        <IconFlag size={14} /> Report
      </button>
      {open && (
        <span className="absolute bottom-full right-0 z-30 mb-1 block w-64 space-y-2 rounded-2xl bg-white p-3 text-left shadow-xl ring-1 ring-stone-200">
          <span className="block text-xs font-semibold text-stone-500">என்ன தவறு?</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="விவரம் (விருப்பம்)" className="input !py-1.5 text-sm" />
          <span className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => <button key={r} onClick={() => send(r)} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-maroon-700 ring-1 ring-amber-200 active:scale-95">{r}</button>)}
          </span>
        </span>
      )}
    </span>
  );
}
