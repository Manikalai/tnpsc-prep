"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY, SECTIONS } from "@/lib/chapter-labels";

type C = { id: number; book: string; std: number; term: string | null; subject: string; section: string | null; no: number; title: string; n: number };
const SUBJECT: Record<string, string> = { tamil: "தமிழ்", social: "சமூக அறிவியல்", science: "அறிவியல்" };

function Chips<T extends string | number>({ items, value, onChange, label }: { items: [T, string][]; value: T | null; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(([v, l]) => (
          <button key={String(v)} onClick={() => onChange(v)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${value === v ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

export type StartQuiz = (p: { chapterIds: number[]; count: number; difficulty: string; title: string }) => Promise<void>;

export default function QuizBuilder({ chapters, onStart }: { chapters: C[]; onStart?: StartQuiz }) {
  const router = useRouter();
  const stds = [...new Set(chapters.map((c) => c.std))].sort((a, b) => a - b);
  const [std, setStd] = useState<number>(stds[0]);
  const [term, setTerm] = useState<string>("all");
  const [subject, setSubject] = useState<string | null>(null);
  const [section, setSection] = useState<string>("all");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [count, setCount] = useState(15);
  const [difficulty, setDifficulty] = useState("mixed");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const inStd = chapters.filter((c) => c.std === std);
  const terms = [...new Set(inStd.map((c) => c.term).filter(Boolean))] as string[];
  const inTerm = inStd.filter((c) => term === "all" || c.term === term);
  const subjects = [...new Set(inTerm.map((c) => c.subject))];
  const inSubject = inTerm.filter((c) => c.subject === subject);
  const sections = [...new Set(inSubject.map((c) => c.section ?? "none"))];
  const list = useMemo(() => inSubject.filter((c) => section === "all" || (c.section ?? "none") === section), [inSubject, section]);
  const unlabelled = inSubject.some((c) => !c.section);

  const reset = () => { setPicked(new Set()); setMsg(""); };
  const toggle = (id: number) => { const s = new Set(picked); s.has(id) ? s.delete(id) : s.add(id); setPicked(s); };
  const allPicked = list.length > 0 && list.every((c) => picked.has(c.id));
  const sectionName = (s: string) => (s === "none" ? "வகைப்படுத்தப்படாதவை" : SECTIONS[subject ?? ""]?.[s] ?? s);

  const start = async () => {
    setBusy(true);
    setMsg("");
    const chosen = chapters.filter((c) => picked.has(c.id));
    const title = `${std}ஆம் வகுப்பு ${SUBJECT[subject ?? ""] ?? ""}${section !== "all" ? ` – ${sectionName(section)}` : ""} · ${chosen.length === 1 ? `பாடம் ${chosen[0].no}: ${chosen[0].title}` : `${chosen.length} பாடங்கள்`} · ${DIFFICULTY[difficulty]}`;
    if (onStart) {
      await onStart({ chapterIds: [...picked], count, difficulty, title });
      setBusy(false);
      return;
    }
    const r = await fetch("/api/quiz-builder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterIds: [...picked], count, difficulty, title }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { if (d.notice) alert(d.notice); router.push(d.redirect); }
    else { setMsg(d.error ?? "பிழை"); setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <Chips label="1. வகுப்பு" items={stds.map((s) => [s, `${s}ஆம்`] as [number, string])} value={std} onChange={(v) => { setStd(v); setTerm("all"); setSubject(null); setSection("all"); reset(); }} />
        {terms.length > 0 && (
          <Chips label="பருவம்" items={[["all", "எல்லாம்"], ...terms.map((t) => [t, `பருவம் ${t}`] as [string, string])]} value={term} onChange={(v) => { setTerm(v); setSubject(null); setSection("all"); reset(); }} />
        )}
        <Chips label="2. பாடம்" items={subjects.map((s) => [s, SUBJECT[s] ?? s] as [string, string])} value={subject} onChange={(v) => { setSubject(v); setSection("all"); reset(); }} />
        {subject && sections.length > 1 && (
          <Chips label="3. பிரிவு" items={[["all", "எல்லாம்"], ...sections.map((s) => [s, sectionName(s)] as [string, string])]} value={section} onChange={(v) => { setSection(v); reset(); }} />
        )}
        {subject && unlabelled && sections.length <= 1 && !onStart && (
          <p className="text-xs text-stone-500">
            பிரிவுகள் (வரலாறு, புவியியல்…) இன்னும் வகைப்படுத்தப்படவில்லை — இரவுப் பணி செய்யும்.{" "}
            <button className="underline" onClick={async () => { const r = await fetch("/api/quiz-builder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify" }) }); const d = await r.json(); alert(d.notice ?? d.error); router.refresh(); }}>இப்போதே வகைப்படுத்து</button>
          </p>
        )}
      </div>

      {subject && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">4. பாடங்கள் ({picked.size} தேர்வு)</p>
            <button className="text-sm underline" onClick={() => setPicked(allPicked ? new Set() : new Set(list.map((c) => c.id)))}>{allPicked ? "எதுவுமில்லை" : "எல்லாம்"}</button>
          </div>
          <ul className="divide-y divide-stone-100">
            {list.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-3 py-2">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-500" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="flex-1">
                    {c.no}. {c.title}
                    <span className="block text-xs text-stone-400">{c.term ? `பருவம் ${c.term} · ` : ""}{c.section ? `${sectionName(c.section)} · ` : ""}{c.n} வினாக்கள் வங்கியில்</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picked.size > 0 && (
        <div className="card space-y-4">
          <Chips label="5. வினாக்களின் எண்ணிக்கை" items={[10, 15, 25, 50].map((n) => [n, String(n)] as [number, string])} value={count} onChange={setCount} />
          <Chips label="கடினம்" items={Object.entries(DIFFICULTY) as [string, string][]} value={difficulty} onChange={setDifficulty} />
          <p className="muted">நேரம் {Math.round((count * 54) / 60)} நிமிடம் (TNPSC வேகம்: ஒரு வினாவுக்கு 54 வினாடி).</p>
          <button className="btn w-full" disabled={busy} onClick={start}>{busy ? "வினாத்தாள் தயாராகிறது… (30 வினாடி வரை)" : "வினாத்தாள் தொடங்கு"}</button>
          {msg && <p className="text-sm text-kumkum-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
