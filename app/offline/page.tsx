"use client";
// Offline practice: download a pack once while online, then take quizzes / mocks, read current affairs,
// notes and flashcards with no internet. Finished tests sync to your account when you are online again.
import { useCallback, useEffect, useMemo, useState } from "react";
import { idb } from "@/lib/offline-db";
import { OPT, pct, taDate } from "@/lib/format";
import TestRunner from "@/components/TestRunner";
import CaList, { type CA } from "@/components/CaList";
import Md from "@/components/Md";

type Q = { id: string; unit_id: string | null; stem: string; options: string[]; answer_index: number; explanation: string | null; source_ref: string | null; origin: string; ca_date: string | null };
type Unit = { id: string; part_id: string; name_ta: string; questions: number; subject: string };
type Part = { id: string; name_ta: string; questions: number; gate_min_marks: number | null };
type Meta = {
  downloadedAt: string;
  exam: { code: string; name_ta: string; duration_min: number; total_questions: number; mark_per_q: number };
  parts: Part[];
  units: Unit[];
  ca: CA[];
  notes: { id: string; unit_id: string; kind: string; title: string; content: string; source_ref: string | null }[];
  flashcards: { id: string; front: string; back: string }[];
  counts: { questions: number };
};
type Active = { localId: string; kind: string; title: string; unit_id: string | null; qs: Q[]; durationSec: number; startedAt: string };
type Attempt = {
  localId: string; kind: string; exam_code: string | null; unit_id: string | null; title: string; question_ids: string[];
  answers: Record<string, number | null>; times?: Record<string, number>; started_at: string; duration_sec: number; elapsedSec: number;
};
type Result = { title: string; correct: number; total: number; marks: number; max: number; parts: { name: string; correct: number; total: number; marks: number; gate: number | null }[]; units: { name: string; correct: number; total: number }[]; gatePassed: boolean | null; review: { q: Q; chosen: number | null }[] };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

export default function Offline() {
  const [online, setOnline] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [pending, setPending] = useState(0);
  const [exam, setExam] = useState("G4");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"practice" | "ca" | "notes" | "cards">("practice");
  const [active, setActive] = useState<Active | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [unitPick, setUnitPick] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await idb.get<Meta>("meta");
      setMeta(m ?? null);
      if (m) {
        setExam(m.exam.code);
        setQuestions(await idb.allQuestions<Q>());
      }
      setPending((await idb.attempts<Attempt>()).length);
    } catch {
      setMsg("இந்த உலாவியில் சேமிப்பு அனுமதிக்கப்படவில்லை (private mode?).");
    }
  }, []);

  const sync = useCallback(async () => {
    const list = await idb.attempts<Attempt>();
    if (!list.length || !navigator.onLine) return;
    setBusy("sync");
    try {
      const r = await fetch("/api/offline/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attempts: list }) });
      if (r.ok) {
        const { synced } = await r.json();
        for (const id of synced as string[]) await idb.deleteAttempt(id);
        setMsg(`${synced.length} தேர்வு முடிவுகள் உங்கள் கணக்கில் சேர்க்கப்பட்டன ✓`);
      }
    } catch {
      /* still offline */
    }
    setPending((await idb.attempts<Attempt>()).length);
    setBusy("");
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    load().then(sync);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [load, sync]);

  const download = async () => {
    setBusy("download");
    setMsg("");
    try {
      const r = await fetch(`/api/offline/pack?exam=${exam}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `பிழை ${r.status}`);
      const pack = await r.json();
      await idb.replaceQuestions(pack.questions);
      const m: Meta = { downloadedAt: pack.downloadedAt, exam: pack.exam, parts: pack.parts, units: pack.units, ca: pack.ca, notes: pack.notes, flashcards: pack.flashcards, counts: { questions: pack.questions.length } };
      await idb.set("meta", m);
      // keep this page and its scripts available offline
      try { const c = await caches.open("tnpsc-v1"); await c.add("/offline"); } catch { /* ignore */ }
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      await load();
      setMsg(`பதிவிறக்கம் முடிந்தது: ${pack.questions.length} வினாக்கள், ${pack.ca.length} நடப்பு நிகழ்வுகள், ${pack.notes.length} குறிப்புகள்.`);
    } catch (e) {
      setMsg(`பதிவிறக்க முடியவில்லை: ${e instanceof Error ? e.message : e}`);
    }
    setBusy("");
  };

  const byUnit = useMemo(() => {
    const m = new Map<string, Q[]>();
    for (const q of questions) if (q.unit_id) m.set(q.unit_id, [...(m.get(q.unit_id) ?? []), q]);
    return m;
  }, [questions]);
  const caQs = useMemo(() => questions.filter((q) => q.origin === "ca"), [questions]);

  const pickFresh = async (pool: Q[], n: number) => {
    const seen = new Set((await idb.get<string[]>("seen")) ?? []);
    return [...shuffle(pool.filter((q) => !seen.has(q.id))), ...shuffle(pool.filter((q) => seen.has(q.id)))].slice(0, n);
  };

  const startMock = async () => {
    if (!meta) return;
    const qs: Q[] = [];
    for (const p of meta.parts) for (const u of meta.units.filter((x) => x.part_id === p.id)) {
      const pool = u.subject === "current" ? [...(byUnit.get(u.id) ?? []), ...caQs] : byUnit.get(u.id) ?? [];
      qs.push(...(await pickFresh(pool, u.questions)));
    }
    if (!qs.length) return setMsg("தொகுப்பில் வினாக்கள் இல்லை — இணையத்தில் இருக்கும்போது மீண்டும் பதிவிறக்கவும்.");
    const durationSec = Math.round(meta.exam.duration_min * 60 * (qs.length / meta.exam.total_questions));
    setResult(null);
    setActive({ localId: uid(), kind: "mock", title: `${meta.exam.name_ta} – மாதிரித் தேர்வு`, unit_id: null, qs, durationSec, startedAt: new Date().toISOString() });
  };
  const startUnit = async (unitId: string) => {
    const u = meta?.units.find((x) => x.id === unitId);
    const qs = await pickFresh(byUnit.get(unitId) ?? [], 15);
    if (!u || !qs.length) return setMsg("இந்த அலகுக்குத் தொகுப்பில் வினாக்கள் இல்லை.");
    setResult(null);
    setActive({ localId: uid(), kind: "quiz", title: u.name_ta, unit_id: unitId, qs, durationSec: qs.length * 54, startedAt: new Date().toISOString() });
  };
  const startCa = async () => {
    const qs = await pickFresh(caQs, 20);
    if (!qs.length) return setMsg("நடப்பு நிகழ்வு வினாக்கள் தொகுப்பில் இல்லை.");
    setResult(null);
    setActive({ localId: uid(), kind: "ca", title: "நடப்பு நிகழ்வுகள் – 30 நாட்கள்", unit_id: null, qs, durationSec: qs.length * 54, startedAt: new Date().toISOString() });
  };

  const finish = async (a: Active, r: { answers: Record<string, number | null>; times: Record<string, number>; elapsedSec: number }) => {
    const markPerQ = a.kind === "mock" ? meta?.exam.mark_per_q ?? 1.5 : 1;
    const unitName = new Map(meta?.units.map((u) => [u.id, u]) ?? []);
    const partStats = new Map<string, { correct: number; total: number }>();
    const unitStats = new Map<string, { correct: number; total: number }>();
    let correct = 0;
    for (const q of a.qs) {
      const ok = r.answers[q.id] === q.answer_index;
      if (ok) correct++;
      const uKey = q.unit_id ?? "ca";
      const us = unitStats.get(uKey) ?? { correct: 0, total: 0 };
      us.total++; if (ok) us.correct++;
      unitStats.set(uKey, us);
      const pKey = (q.unit_id && unitName.get(q.unit_id)?.part_id) || "other";
      const ps = partStats.get(pKey) ?? { correct: 0, total: 0 };
      ps.total++; if (ok) ps.correct++;
      partStats.set(pKey, ps);
    }
    let gatePassed: boolean | null = null;
    const parts = a.kind === "mock" && meta
      ? meta.parts.map((p) => {
          const s = partStats.get(p.id) ?? { correct: 0, total: 0 };
          const marks = s.correct * markPerQ;
          if (p.gate_min_marks != null) gatePassed = marks >= Number(p.gate_min_marks);
          return { name: p.name_ta, ...s, marks, gate: p.gate_min_marks };
        })
      : [];
    const res: Result = {
      title: a.title, correct, total: a.qs.length, marks: correct * markPerQ, max: a.qs.length * markPerQ, parts,
      units: [...unitStats.entries()].map(([id, s]) => ({ name: unitName.get(id)?.name_ta ?? "நடப்பு நிகழ்வுகள்", ...s })),
      gatePassed, review: a.qs.map((q) => ({ q, chosen: r.answers[q.id] ?? null })),
    };
    const attempt: Attempt = {
      localId: a.localId, kind: a.kind, exam_code: meta?.exam.code ?? null, unit_id: a.unit_id, title: a.title,
      question_ids: a.qs.map((q) => q.id), answers: r.answers, times: r.times, started_at: a.startedAt, duration_sec: a.durationSec, elapsedSec: r.elapsedSec,
    };
    await idb.putAttempt(attempt);
    const seen = new Set((await idb.get<string[]>("seen")) ?? []);
    a.qs.forEach((q) => seen.add(q.id));
    await idb.set("seen", [...seen]);
    setActive(null);
    setResult(res);
    setPending((p) => p + 1);
    sync();
  };

  if (active)
    return (
      <TestRunner
        testId={`offline-${active.localId}`}
        title={active.title}
        kind={active.kind}
        durationSec={active.durationSec}
        startedAt={active.startedAt}
        questions={active.qs.map((q) => ({ id: q.id, stem: q.stem, options: q.options, unverified: q.origin === "ai" && !q.source_ref }))}
        onSubmit={(r) => finish(active, r)}
      />
    );

  return (
    <div className="space-y-4">
      <h1 className="h1">இணையமின்றிப் பயிற்சி</h1>
      <div className="card space-y-2">
        <p className="text-sm">
          நிலை: {online ? <span className="font-semibold text-brand-600">இணையத்தில் உள்ளீர்கள்</span> : <span className="font-semibold text-kumkum-500">இணையம் இல்லை</span>}
          {pending > 0 && <> · ஒத்திசைக்க வேண்டியவை: <b>{pending}</b></>}
        </p>
        {meta ? (
          <p className="text-sm">
            தொகுப்பு: <b>{meta.exam.name_ta}</b> · {meta.counts.questions} வினாக்கள் · {meta.ca.length} நடப்பு நிகழ்வுகள் · {meta.notes.length} குறிப்புகள் · {meta.flashcards.length} அட்டைகள்
            <br />
            <span className="muted">பதிவிறக்கியது: {taDate(meta.downloadedAt)}</span>
          </p>
        ) : (
          <p className="muted">இன்னும் தொகுப்பு பதிவிறக்கப்படவில்லை. இணையத்தில் இருக்கும்போது கீழே பதிவிறக்கவும்.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={exam} onChange={(e) => setExam(e.target.value)}>
            <option value="G4">தொகுதி IV</option>
            <option value="G2">தொகுதி II / IIA</option>
            <option value="G1">தொகுதி I</option>
          </select>
          <button className="btn" disabled={!online || !!busy} onClick={download}>{busy === "download" ? "பதிவிறக்குகிறது…" : meta ? "புதுப்பி / மீண்டும் பதிவிறக்கு" : "பதிவிறக்கு"}</button>
          {pending > 0 && <button className="btn-ghost" disabled={!online || !!busy} onClick={sync}>{busy === "sync" ? "…" : "இப்போது ஒத்திசை"}</button>}
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <p className="muted">குறிப்பு: இந்தப் பக்கத்தை முகப்புத் திரையில் சேர்த்த செயலியிலிருந்து ஒருமுறை இணையத்தில் திறந்திருக்க வேண்டும்; பிறகு இணையமின்றியும் திறக்கும்.</p>
      </div>

      {result && (
        <div className="card space-y-3">
          <p className="muted">{result.title}</p>
          <p className="text-4xl font-bold text-brand-700">{result.marks}<span className="text-xl text-stone-400">/{result.max}</span></p>
          <p className="text-sm">சரி {result.correct}/{result.total} · {pending > 0 ? "இணையம் வந்ததும் உங்கள் கணக்கில் சேரும்" : "உங்கள் கணக்கில் சேர்க்கப்பட்டது ✓"}</p>
          {result.gatePassed === false && <p className="rounded-xl bg-kumkum-50 p-3 text-sm text-kumkum-500">தமிழ்ப் பகுதியில் தகுதி மதிப்பெண் (60/150) கிடைக்கவில்லை.</p>}
          {result.parts.map((p) => <p key={p.name} className="flex justify-between text-sm"><span>{p.name}</span><b>{p.marks} ({p.correct}/{p.total})</b></p>)}
          <div>
            {result.units.map((u) => (
              <div key={u.name} className="py-1 text-sm">
                <div className="flex justify-between"><span>{u.name}</span><span>{u.correct}/{u.total}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct(u.correct, u.total)}%` }} /></div>
              </div>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer font-semibold">தவறியவை / விடையில்லாதவை ({result.review.filter((r) => r.chosen !== r.q.answer_index).length})</summary>
            {result.review.filter((r) => r.chosen !== r.q.answer_index).map(({ q, chosen }) => (
              <div key={q.id} className="mt-3 border-t border-stone-100 pt-3 text-sm">
                <p className="font-medium whitespace-pre-line">{q.stem}</p>
                {q.options.map((o, k) => (
                  <p key={k} className={k === q.answer_index ? "font-semibold text-brand-700" : chosen === k ? "text-kumkum-500 line-through" : ""}>{OPT[k]}) {o}</p>
                ))}
                {q.explanation && <p className="mt-1 rounded bg-stone-50 p-2">{q.explanation}</p>}
              </div>
            ))}
          </details>
          <button className="btn-ghost btn-sm" onClick={() => setResult(null)}>மூடு</button>
        </div>
      )}

      {meta && (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {([["practice", "பயிற்சி"], ["ca", "நடப்பு நிகழ்வுகள்"], ["notes", "குறிப்புகள்"], ["cards", "அட்டைகள்"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
            ))}
          </div>

          {tab === "practice" && (
            <div className="space-y-3">
              <div className="card flex items-center justify-between gap-2">
                <div><p className="font-semibold">முழு மாதிரித் தேர்வு</p><p className="muted">{meta.exam.total_questions} வினாக்கள் · {meta.exam.duration_min / 60} மணி நேரம்</p></div>
                <button className="btn" onClick={startMock}>தொடங்கு</button>
              </div>
              <div className="card space-y-2">
                <p className="font-semibold">அலகு வினாடி வினா (15 வினாக்கள்)</p>
                <div className="flex gap-2">
                  <select className="input" value={unitPick} onChange={(e) => setUnitPick(e.target.value)}>
                    <option value="">அலகைத் தேர்ந்தெடுக்கவும்</option>
                    {meta.units.map((u) => <option key={u.id} value={u.id}>{u.name_ta} ({byUnit.get(u.id)?.length ?? 0})</option>)}
                  </select>
                  <button className="btn" disabled={!unitPick} onClick={() => startUnit(unitPick)}>தொடங்கு</button>
                </div>
              </div>
              <div className="card flex items-center justify-between gap-2">
                <div><p className="font-semibold">நடப்பு நிகழ்வுகள் வினாக்கள்</p><p className="muted">கடந்த 30 நாட்கள் · {caQs.length} வினாக்கள்</p></div>
                <button className="btn" disabled={!caQs.length} onClick={startCa}>தொடங்கு</button>
              </div>
            </div>
          )}

          {tab === "ca" && <div className="space-y-4">{[...new Set(meta.ca.map((c) => c.ca_date ?? ""))].map((d) => (
            <details key={d} className="card">
              <summary className="cursor-pointer font-semibold">{taDate(d, true)}</summary>
              <div className="mt-3 space-y-3"><CaList items={meta.ca.filter((c) => c.ca_date === d)} /></div>
            </details>
          ))}</div>}

          {tab === "notes" && (
            <div className="space-y-3">
              {!meta.notes.length && <p className="muted">குறிப்புகள் இல்லை. &quot;நினைவுக் குறிப்புகள்&quot; பகுதியில் உருவாக்கிப் பிறகு பதிவிறக்கவும்.</p>}
              {meta.units.filter((u) => meta.notes.some((n) => n.unit_id === u.id)).map((u) => (
                <details key={u.id} className="card">
                  <summary className="cursor-pointer font-semibold">{u.name_ta}</summary>
                  {meta.notes.filter((n) => n.unit_id === u.id).map((n) => (
                    <div key={n.id} className="mt-3 border-t border-stone-100 pt-3"><p className="font-bold">{n.title}</p><Md text={n.content} /></div>
                  ))}
                </details>
              ))}
            </div>
          )}

          {tab === "cards" && <OfflineCards cards={meta.flashcards} />}
        </>
      )}
    </div>
  );
}

function OfflineCards({ cards }: { cards: { id: string; front: string; back: string }[] }) {
  const [order] = useState(() => shuffle(cards));
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const c = order[i % Math.max(order.length, 1)];
  if (!c) return <p className="muted">அட்டைகள் இல்லை.</p>;
  return (
    <div>
      <button onClick={() => setFlip(!flip)} className="card flex min-h-48 w-full flex-col items-center justify-center text-center">
        <p className="text-xs text-stone-400">{(i % order.length) + 1}/{order.length}</p>
        <p className={`mt-3 text-xl ${flip ? "text-brand-700" : ""}`}>{flip ? c.back : c.front}</p>
      </button>
      <button className="btn mt-3 w-full" onClick={() => { setFlip(false); setI(i + 1); }}>அடுத்த அட்டை</button>
    </div>
  );
}
