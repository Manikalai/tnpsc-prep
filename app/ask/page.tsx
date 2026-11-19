"use client";
import { useState } from "react";
import Md from "@/components/Md";

export default function Ask() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ answer: string; sources: { book: string; page: number | null }[]; grounded: boolean } | null>(null);
  const [err, setErr] = useState("");
  return (
    <div className="space-y-4">
      <p className="muted">உங்கள் சந்தேகத்தைத் தமிழில் கேளுங்கள். சமச்சீர் பாடநூல்களிலிருந்து ஆதாரத்துடன் விடை தரப்படும்.</p>
      <textarea className="input min-h-28" value={q} onChange={(e) => setQ(e.target.value)} placeholder="எ.கா. அரசின் நெறிமுறைக் கோட்பாடுகள் எந்தப் பகுதியில் உள்ளன?" />
      <button
        className="btn"
        disabled={busy || !q.trim()}
        onClick={async () => {
          setBusy(true); setErr(""); setRes(null);
          const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
          const d = await r.json().catch(() => ({}));
          if (r.ok) setRes(d); else setErr(d.error ?? "பிழை");
          setBusy(false);
        }}
      >
        {busy ? "தேடுகிறது…" : "கேள்"}
      </button>
      {err && <p className="text-kumkum-500">{err}</p>}
      {res && (
        <div className="card">
          <Md text={res.answer} />
          {res.sources.length > 0 && (
            <div className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-500">
              {res.sources.map((s, k) => <p key={k}>[{k + 1}] {s.book}{s.page ? `, பக். ${s.page}` : ""}</p>)}
            </div>
          )}
          {!res.grounded && <p className="mt-2 text-xs text-turmeric-500">⚠ பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை — விடையைச் சரிபார்க்கவும்.</p>}
        </div>
      )}
    </div>
  );
}
