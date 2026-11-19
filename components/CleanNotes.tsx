"use client";
// "எளிய குறிப்புகள்": the lesson rewritten neatly from the textbook (spelling fixed, headings, bullets, bold key words).
import { useState } from "react";
import Md from "@/components/Md";
import type { Clean, CleanSection } from "@/lib/chapters";

export function CleanView({ clean }: { clean: Clean }) {
  const sections = clean.parts.flat().filter(Boolean) as CleanSection[];
  return (
    <div className="space-y-3">
      {sections.map((s, k) => (
        <section key={k} className="card reading">
          <div className="mb-1 flex items-start justify-between gap-3">
            {s.title ? <h2 className="text-[19px] font-bold leading-snug text-brand-700">{s.title}</h2> : <span />}
            {s.page ? <span className="chip shrink-0">பக். {s.page}</span> : null}
          </div>
          <Md text={s.md} />
        </section>
      ))}
    </div>
  );
}

export default function CleanNotes({ chapterId, initial }: { chapterId: number; initial: Clean | null }) {
  const [clean, setClean] = useState<Clean | null>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const done = !!clean && clean.parts.length >= clean.total && clean.parts.every((p) => p?.length);

  async function run() {
    setErr(null);
    let cur = clean;
    try {
      for (let i = 0; ; i++) {
        if (cur && i >= cur.total) break;
        if (cur?.parts[i]?.length) continue;
        setBusy(cur ? `பகுதி ${i + 1}/${cur.total} எழுதுகிறது…` : "பாடத்தைப் படித்து எழுதுகிறது…");
        const r = await fetch("/api/chapter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clean", chapterId, part: i }) });
        const d = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
        const parts = [...(cur?.parts ?? [])];
        parts[i] = d.sections;
        for (let k = 0; k < d.total; k++) parts[k] ??= [];
        cur = { parts, total: d.total };
        setClean(cur);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {clean && <CleanView clean={clean} />}
      {!done && (
        <div className="card space-y-2 text-center">
          <p className="text-sm text-stone-600">
            {clean ? "இந்தப் பாடத்தின் மீதிப் பகுதிகள் இன்னும் எழுதப்படவில்லை." : "இந்தப் பாடம் இன்னும் எளிய குறிப்புகளாக எழுதப்படவில்லை (இரவுப் பணி படிப்படியாக எல்லாப் பாடங்களையும் எழுதும்)."}
          </p>
          <button className="btn" disabled={!!busy} onClick={run}>{busy ?? (clean ? "மீதியை எழுது" : "இப்போதே எழுது")}</button>
          {busy && <p className="muted">ஒவ்வொரு பகுதிக்கும் 20–50 வினாடி</p>}
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      )}
      {done && <p className="muted text-center">பாடநூல் உரையிலிருந்து AI எழுதியது — சந்தேகம் இருந்தால் “பாடநூல்” பக்கத்துடன் ஒப்பிடுக.</p>}
    </div>
  );
}
