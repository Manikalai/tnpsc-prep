"use client";
import { useState } from "react";

/** Adds a set of memory cards to the user's flashcards (spaced review: 1, 3, 7, 15 … days). */
export default function AddCards({ cards, label = "நினைவு அட்டைகளாகச் சேர்" }: { cards: { front: string; back: string }[]; label?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addMany", cards }) });
            const d = await r.json().catch(() => ({}));
            setMsg(d.notice ?? (r.ok ? "சேர்க்கப்பட்டது" : "பிழை"));
          } finally {
            setBusy(false);
          }
        }}
      >
        🃏 {label} ({cards.length})
      </button>
      {msg && <span className="text-sm text-brand-700">{msg}</span>}
    </div>
  );
}
