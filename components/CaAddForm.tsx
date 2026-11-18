"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CaAddForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [region, setRegion] = useState("tn");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">செய்தியை நீங்களே சேர்க்க (அரசாணை, DIPR செய்திக்குறிப்பு…)</summary>
      <div className="mt-3 space-y-2">
        <textarea className="input min-h-32" placeholder="செய்தியின் உரையை இங்கே ஒட்டவும் (தமிழ் அல்லது ஆங்கிலம்)" value={text} onChange={(e) => setText(e.target.value)} />
        <input className="input" placeholder="இணைப்பு (விருப்பம்)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="tn">தமிழ்நாடு</option>
          <option value="india">இந்தியா</option>
        </select>
        <button
          className="btn"
          disabled={busy || text.length < 20}
          onClick={async () => {
            setBusy(true);
            setMsg("");
            const r = await fetch("/api/ca/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, url, region }) });
            const d = await r.json().catch(() => ({}));
            setMsg(d.notice ?? d.error ?? "");
            if (r.ok) { setText(""); setUrl(""); router.refresh(); }
            setBusy(false);
          }}
        >
          {busy ? "குறிப்பு எழுதுகிறது…" : "தமிழ்க் குறிப்பாக்கு"}
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </details>
  );
}
