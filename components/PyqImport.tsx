"use client";
import { useState } from "react";

export default function PyqImport({ units }: { units: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">முந்தைய ஆண்டு வினாக்களைச் சேர் (JSON)</summary>
      <p className="muted mt-2">
        scripts/pyq_to_json.py கருவி TNPSC வினாத்தாள் PDF + விடைக்குறிப்பை இந்த வடிவத்துக்கு மாற்றும். ஒவ்வொரு வினாவும்:
      </p>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-stone-50 p-2 text-xs">{`[{"stem":"…","options":["…","…","…","…"],"answer_index":2,"unit_id":"${units[0]?.id ?? "G4-GS-4"}","year":2024}]`}</pre>
      <details className="mt-1 text-xs"><summary>அலகு குறியீடுகள்</summary>{units.map((u) => <p key={u.id}><code>{u.id}</code> — {u.name}</p>)}</details>
      <textarea className="input mt-2 min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="[ … ]" />
      <button
        className="btn mt-2"
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            const items = JSON.parse(text);
            const r = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
            const d = await r.json();
            setMsg(d.notice ?? d.error);
          } catch {
            setMsg("JSON வடிவம் தவறு");
          }
          setBusy(false);
        }}
      >
        {busy ? "…" : "சேர்"}
      </button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </details>
  );
}
