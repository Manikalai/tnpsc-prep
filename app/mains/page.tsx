"use client";
import { useState } from "react";
import { G1_MAINS } from "@/data/syllabus";
import Md from "@/components/Md";

type Eval = { score: number; strengths: string[]; improve: string[]; missing_points: string[]; model_outline: string };

export default function Mains() {
  const [paper, setPaper] = useState(0);
  const [unit, setUnit] = useState(0);
  const [qn, setQn] = useState<{ question: string; marks: number; words: number } | null>(null);
  const [answer, setAnswer] = useState("");
  const [ev, setEv] = useState<Eval | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const post = async (body: unknown) => {
    const r = await fetch("/api/mains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error ?? "பிழை");
    return d;
  };
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="input" value={paper} onChange={(e) => { setPaper(+e.target.value); setUnit(0); }}>
          {G1_MAINS.map((p, k) => <option key={k} value={k}>{p.paper}</option>)}
        </select>
        <select className="input" value={unit} onChange={(e) => setUnit(+e.target.value)}>
          {G1_MAINS[paper].units.map((u, k) => <option key={k} value={k}>{u}</option>)}
        </select>
      </div>
      <button className="btn" disabled={!!busy} onClick={async () => { setBusy("q"); setErr(""); setEv(null); setAnswer(""); try { setQn(await post({ action: "question", paper, unit })); } catch (e) { setErr(String((e as Error).message)); } setBusy(""); }}>
        {busy === "q" ? "…" : "புதிய வினா"}
      </button>
      {qn && (
        <div className="card space-y-3">
          <p className="font-semibold">{qn.question}</p>
          <p className="muted">{qn.marks} மதிப்பெண் · சுமார் {qn.words} சொற்கள்</p>
          <textarea className="input min-h-64" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="உங்கள் விடையைத் தமிழில் எழுதவும் (முன்னுரை, கருத்துகள், முடிவுரை)" />
          <p className="muted">{words} சொற்கள்</p>
          <button className="btn" disabled={!!busy || words < 10} onClick={async () => { setBusy("e"); setErr(""); try { setEv(await post({ action: "evaluate", question: qn.question, answer, marks: qn.marks })); } catch (e) { setErr(String((e as Error).message)); } setBusy(""); }}>
            {busy === "e" ? "மதிப்பிடுகிறது…" : "மதிப்பிடு"}
          </button>
        </div>
      )}
      {err && <p className="text-kumkum-500">{err}</p>}
      {ev && qn && (
        <div className="card space-y-3">
          <p className="text-3xl font-bold text-brand-700">{ev.score}/{qn.marks}</p>
          <div><h3 className="font-bold">நன்றாக உள்ளவை</h3><ul className="list-disc pl-5">{ev.strengths.map((s, k) => <li key={k}>{s}</li>)}</ul></div>
          <div><h3 className="font-bold">மேம்படுத்த</h3><ul className="list-disc pl-5">{ev.improve.map((s, k) => <li key={k}>{s}</li>)}</ul></div>
          <div><h3 className="font-bold">விடுபட்ட கருத்துகள்</h3><ul className="list-disc pl-5">{ev.missing_points.map((s, k) => <li key={k}>{s}</li>)}</ul></div>
          <div><h3 className="font-bold">மாதிரி விடைக் கட்டமைப்பு</h3><Md text={ev.model_outline} /></div>
        </div>
      )}
    </div>
  );
}
