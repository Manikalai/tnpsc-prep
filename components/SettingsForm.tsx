"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SettingsForm({ name, exam, date }: { name: string; exam: string; date: string }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [e, setE] = useState(exam);
  const [d, setD] = useState(date);
  const [msg, setMsg] = useState("");
  return (
    <div className="card space-y-3">
      <label className="block text-sm font-semibold">பெயர்</label>
      <input className="input" value={n} onChange={(x) => setN(x.target.value)} />
      <label className="block text-sm font-semibold">இலக்குத் தேர்வு</label>
      <select className="input" value={e} onChange={(x) => setE(x.target.value)}>
        <option value="G4">தொகுதி IV</option>
        <option value="G2">தொகுதி II / IIA</option>
        <option value="G1">தொகுதி I</option>
      </select>
      <label className="block text-sm font-semibold">தேர்வு தேதி (காலியாக விட்டால் அதிகாரபூர்வ தேதி)</label>
      <input className="input" type="date" value={d} onChange={(x) => setD(x.target.value)} />
      <div className="flex gap-2">
        <button
          className="btn"
          onClick={async () => {
            const r = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: n, target_exam: e, exam_date: d || null }) });
            const j = await r.json();
            setMsg(j.notice ?? j.error);
            router.refresh();
          }}
        >
          சேமி
        </button>
        <button className="btn-ghost" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); }}>Sign out</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
