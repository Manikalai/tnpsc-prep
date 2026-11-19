"use client";
// Full offline mode: everything below runs from data saved on the phone.
import { useCallback, useEffect, useMemo, useState } from "react";
import { idb } from "@/lib/offline-db";
import { fullDownload, getSettings, incrementalSync, storageInfo, syncAttempts, type OfflineMeta, type Settings } from "@/lib/offline-sync";
import { paperNo, scoreLocal, type OQ, type Result } from "@/lib/offline-score";
import { taDate } from "@/lib/format";
import TestRunner from "@/components/TestRunner";
import QuizBuilder from "@/components/QuizBuilder";
import CaList from "@/components/CaList";
import OfflineBooks from "./OfflineBooks";
import OfflineResult from "./OfflineResult";

type Active = { localId: string; kind: string; title: string; exam: string | null; unit_id: string | null; qs: OQ[]; durationSec: number; startedAt: string };
const TABS = [["home", "Download"], ["books", "Textbooks"], ["builder", "Quiz"], ["tests", "Tests"], ["ca", "Current affairs"], ["cards", "Cards"]] as const;
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const EXAM_LABEL: Record<string, string> = { G4: "தொகுதி IV", G2: "தொகுதி II / IIA", G1: "தொகுதி I" };

export default function OfflineApp() {
  const [online, setOnline] = useState(true);
  const [meta, setMeta] = useState<OfflineMeta | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [questions, setQuestions] = useState<OQ[]>([]);
  const [pending, setPending] = useState(0);
  const [storage, setStorage] = useState<{ usedMB: number; quotaMB: number } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("home");
  const [stds, setStds] = useState<number[]>([6, 7, 8, 9, 10]);
  const [prog, setProg] = useState<{ msg: string; pct: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState<Active | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const reload = useCallback(async () => {
    try {
      const [m, s, qs, att] = await Promise.all([idb.get<OfflineMeta>("meta"), getSettings(), idb.all<OQ>("questions"), idb.attempts<unknown>()]);
      setMeta(m ?? null);
      setSettings(s);
      if (s.stds.length) setStds(s.stds);
      setQuestions(qs);
      setPending(att.length);
      setStorage(await storageInfo());
    } catch {
      setMsg("இந்த உலாவியில் சேமிப்பு அனுமதிக்கப்படவில்லை (private mode?).");
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    reload();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [reload]);

  const doDownload = async () => {
    setMsg("");
    try {
      await fullDownload(stds, (m, pct) => setProg({ msg: m, pct }));
      setMsg("பதிவிறக்கம் முடிந்தது ✓ இனி இணையமின்றியும் பயன்படுத்தலாம்.");
    } catch (e) {
      setMsg(`பதிவிறக்க முடியவில்லை: ${e instanceof Error ? e.message : e}. மீண்டும் முயலவும் — முடிந்த பகுதிகள் சேமிக்கப்பட்டுள்ளன.`);
    }
    setProg(null);
    reload();
  };
  const doUpdate = async () => {
    setMsg("");
    try {
      await incrementalSync((m, pct) => setProg({ msg: m, pct }));
      setMsg("புதுப்பிக்கப்பட்டது ✓");
    } catch (e) {
      setMsg(`புதுப்பிக்க முடியவில்லை: ${e instanceof Error ? e.message : e}`);
    }
    setProg(null);
    reload();
  };
  const toggleAuto = async () => {
    const s = { ...(settings ?? (await getSettings())), auto: !(settings?.auto ?? true) };
    await idb.set("settings", s);
    setSettings(s);
  };

  // ---------- tests ----------
  const byUnit = useMemo(() => {
    const m = new Map<string, OQ[]>();
    for (const q of questions) if (q.unit_id) m.set(q.unit_id, [...(m.get(q.unit_id) ?? []), q]);
    return m;
  }, [questions]);
  const papers = useMemo(() => {
    const m = new Map<string, OQ[]>();
    for (const q of questions) if (q.origin === "pyq" && q.exam_code && q.pyq_year) m.set(`${q.exam_code}|${q.pyq_year}`, [...(m.get(`${q.exam_code}|${q.pyq_year}`) ?? []), q]);
    return [...m.entries()].map(([k, qs]) => ({ exam: k.split("|")[0], year: Number(k.split("|")[1]), qs: qs.sort((a, b) => paperNo(a.source_ref) - paperNo(b.source_ref)) })).sort((a, b) => b.year - a.year);
  }, [questions]);

  const fresh = async (pool: OQ[], n: number) => {
    const seen = new Set((await idb.get<string[]>("seen")) ?? []);
    return [...shuffle(pool.filter((q) => !seen.has(q.id))), ...shuffle(pool.filter((q) => seen.has(q.id)))].slice(0, n);
  };
  const begin = (a: Omit<Active, "localId" | "startedAt">) => { setResult(null); setActive({ ...a, localId: uid(), startedAt: new Date().toISOString() }); };

  const startMock = async (code: string) => {
    if (!meta) return;
    const exam = meta.exams.find((e) => e.code === code)!;
    const qs: OQ[] = [];
    for (const p of meta.parts.filter((x) => x.exam_code === code))
      for (const u of meta.units.filter((x) => x.part_id === p.id)) {
        const pool = u.subject === "current" ? [...(byUnit.get(u.id) ?? []), ...questions.filter((q) => q.origin === "ca")] : byUnit.get(u.id) ?? [];
        qs.push(...(await fresh(pool, u.questions)));
      }
    if (!qs.length) return setMsg("இந்தத் தேர்வுக்கு வினாக்கள் இல்லை — இணையத்தில் இருக்கும்போது புதுப்பிக்கவும்.");
    begin({ kind: "mock", exam: code, unit_id: null, title: `${exam.name_ta} – மாதிரித் தேர்வு`, qs, durationSec: Math.round(exam.duration_min * 60 * (qs.length / exam.total_questions)) });
  };
  const startPaper = (p: { exam: string; year: number; qs: OQ[] }) =>
    begin({ kind: "mock", exam: p.exam, unit_id: null, title: `TNPSC ${EXAM_LABEL[p.exam]} ${p.year} – உண்மை வினாத்தாள்`, qs: p.qs, durationSec: Math.round(180 * 60 * (p.qs.length / 200)) });
  const startDaily = async () => {
    const seen = new Set((await idb.get<string[]>("seen")) ?? []);
    const units = meta?.units.filter((u) => u.exam_code === "G4") ?? [];
    const qs: OQ[] = [];
    for (const u of shuffle(units).slice(0, 10)) qs.push(...shuffle((byUnit.get(u.id) ?? []).filter((q) => !seen.has(q.id))).slice(0, 2));
    if (!qs.length) return setMsg("வினாக்கள் இல்லை.");
    begin({ kind: "daily", exam: null, unit_id: null, title: `இன்றைய பயிற்சி (இணையமின்றி)`, qs: qs.slice(0, 20), durationSec: qs.length * 54 });
  };
  const startBuilder = async (p: { chapterIds: number[]; count: number; difficulty: string; title: string }) => {
    let pool = questions.filter((q) => q.chapter_id && p.chapterIds.includes(q.chapter_id));
    if (p.difficulty !== "mixed") pool = pool.filter((q) => q.difficulty === p.difficulty);
    const qs = await fresh(pool, p.count);
    if (!qs.length) return setMsg("இந்தப் பாடங்களுக்குச் சேமித்த வினாக்கள் இல்லை. இணையத்தில் இருக்கும்போது வினாத்தாள் உருவாக்கினால் புதிய வினாக்கள் சேரும்.");
    begin({ kind: "quiz", exam: null, unit_id: null, title: p.title, qs, durationSec: qs.length * 54 });
  };
  const startChapter = async (chapterId: number, title: string) => {
    const qs = await fresh(questions.filter((q) => q.chapter_id === chapterId), 15);
    if (!qs.length) return setMsg("இந்தப் பாடத்துக்குச் சேமித்த வினாக்கள் இல்லை.");
    begin({ kind: "quiz", exam: null, unit_id: null, title, qs, durationSec: qs.length * 54 });
  };

  const finish = async (a: Active, r: { answers: Record<string, number | null>; times: Record<string, number>; elapsedSec: number }) => {
    const exam = meta?.exams.find((e) => e.code === a.exam);
    const res = scoreLocal(a.title, a.qs, r.answers, {
      mock: a.kind === "mock", markPerQ: exam?.mark_per_q ?? 1.5,
      units: meta?.units ?? [], parts: (meta?.parts ?? []).filter((p) => !a.exam || p.exam_code === a.exam),
    });
    await idb.putAttempt({
      localId: a.localId, kind: a.kind, exam_code: a.exam, unit_id: a.unit_id, title: a.title, question_ids: a.qs.map((q) => q.id),
      answers: r.answers, times: r.times, started_at: a.startedAt, duration_sec: a.durationSec, elapsedSec: r.elapsedSec,
    });
    const seen = new Set((await idb.get<string[]>("seen")) ?? []);
    a.qs.forEach((q) => seen.add(q.id));
    await idb.set("seen", [...seen]);
    setActive(null);
    setResult(res);
    if (navigator.onLine) await syncAttempts().catch(() => 0);
    reload();
    window.scrollTo(0, 0);
  };

  if (active)
    return (
      <TestRunner testId={`offline-${active.localId}`} title={active.title} kind={active.kind} durationSec={active.durationSec} startedAt={active.startedAt}
        questions={active.qs.map((q) => ({ id: q.id, stem: q.stem, options: q.options, unverified: false }))} onSubmit={(r) => finish(active, r)} />
    );

  const builderChapters = (meta?.chapters ?? []).filter((c) => settings?.stds.includes(c.std)).map((c) => ({
    id: c.id, book: c.book, std: c.std, term: c.term, subject: c.subject, section: c.section, no: c.chapter_no, title: c.title_ta,
    n: questions.filter((q) => q.chapter_id === c.id).length,
  }));

  return (
    <div className="space-y-4">
      <h1 className="h1">இணையமின்றி</h1>
      <p className="text-sm">
        {online ? <span className="font-semibold text-brand-600">● இணையத்தில்</span> : <span className="font-semibold text-kumkum-500">● இணையம் இல்லை</span>}
        {meta && <> · {questions.length} வினாக்கள் · {settings?.stds.length ? `${settings.stds.join(", ")}ஆம் வகுப்புகள்` : ""}</>}
        {pending > 0 && <> · ஒத்திசைக்க {pending}</>}
      </p>
      {result && <OfflineResult result={result} online={online} onClose={() => setResult(null)} />}
      {msg && <p className="rounded-xl bg-turmeric-50 p-3 text-sm">{msg}</p>}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} disabled={k !== "home" && !meta} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold disabled:opacity-40 ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>

      {tab === "home" && (
        <div className="card space-y-3">
          <p className="font-semibold">எந்த வகுப்புப் பாடநூல்களைச் சேமிக்க வேண்டும்?</p>
          <div className="flex flex-wrap gap-2">
            {[6, 7, 8, 9, 10, 11, 12].map((s) => (
              <button key={s} onClick={() => setStds(stds.includes(s) ? stds.filter((x) => x !== s) : [...stds, s].sort((a, b) => a - b))}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${stds.includes(s) ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{s}ஆம்</button>
            ))}
          </div>
          <p className="muted">தொகுதி IV: 6–10 போதும். தொகுதி I, II: 6–12. வினா வங்கி, நடப்பு நிகழ்வுகள் (60 நாட்கள்), குறிப்புகள், அட்டைகள், சேமித்த விளக்கங்கள் எப்போதும் சேரும்.</p>
          {prog ? (
            <div>
              <div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(prog.pct)}%` }} /></div>
              <p className="muted mt-1">{prog.msg}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={!online || !stds.length} onClick={doDownload}>{settings?.lastFull ? "Download all again" : "Download"}</button>
              {settings?.lastSync && <button className="btn-ghost" disabled={!online} onClick={doUpdate}>Update new only</button>}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={settings?.auto ?? true} onChange={toggleAuto} />
            செயலியைத் திறக்கும்போது இணையம் இருந்தால் தானாகப் புதுப்பி
          </label>
          <p className="muted">
            {settings?.lastSync ? `கடைசியாகப் புதுப்பித்தது: ${taDate(settings.lastSync)}` : "இன்னும் பதிவிறக்கவில்லை."}
            {storage ? ` · கைப்பேசியில் பயன்படுத்தியது ${storage.usedMB} MB` : ""}
          </p>
          <p className="muted">AI மூலம் புதிதாக உருவாக்குவது (புதிய வினாக்கள், இன்னும் உருவாக்கப்படாத சுருக்கம்/விளக்கம்) இணையத்தில் மட்டுமே. ஏற்கனவே உருவானவை அனைத்தும் இணையமின்றி இயங்கும்.</p>
        </div>
      )}

      {tab === "books" && meta && <OfflineBooks meta={meta} stds={settings?.stds ?? []} questions={questions} onQuiz={startChapter} />}

      {tab === "builder" && meta && (builderChapters.length ? <QuizBuilder chapters={builderChapters} onStart={startBuilder} /> : <p className="card">சேமித்த பாடநூல்கள் இல்லை.</p>)}

      {tab === "tests" && meta && (
        <div className="space-y-3">
          <div className="card flex items-center justify-between gap-2">
            <div><p className="font-semibold">இன்றைய பயிற்சி</p><p className="muted">20 கலப்பு வினாக்கள்</p></div>
            <button className="btn" onClick={startDaily}>Start</button>
          </div>
          {meta.exams.map((e) => (
            <div key={e.code} className="card flex items-center justify-between gap-2">
              <div><p className="font-semibold">{e.name_ta} – மாதிரித் தேர்வு</p><p className="muted">{e.total_questions} வினாக்கள் · {e.duration_min / 60} மணி நேரம்</p></div>
              <button className="btn" onClick={() => startMock(e.code)}>Start</button>
            </div>
          ))}
          <div className="card">
            <p className="mb-2 font-semibold">TNPSC உண்மை வினாத்தாள்கள்</p>
            {!papers.length && <p className="muted">முந்தைய ஆண்டு வினாத்தாள்கள் இன்னும் சேர்க்கப்படவில்லை.</p>}
            {papers.map((p) => (
              <div key={`${p.exam}${p.year}`} className="flex items-center justify-between border-t border-stone-100 py-2">
                <span>{EXAM_LABEL[p.exam]} {p.year} <span className="muted">({p.qs.length} வினாக்கள்)</span></span>
                <button className="btn btn-sm" onClick={() => startPaper(p)}>Write</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ca" && meta && (
        <div className="space-y-3">
          <button className="btn" onClick={async () => { const qs = await fresh(questions.filter((q) => q.origin === "ca"), 20); if (qs.length) begin({ kind: "ca", exam: null, unit_id: null, title: "நடப்பு நிகழ்வுகள் வினாக்கள்", qs, durationSec: qs.length * 54 }); }}>நடப்பு நிகழ்வு வினாக்கள்</button>
          {[...new Set(meta.ca.map((c) => c.ca_date))].map((d) => (
            <details key={d} className="card">
              <summary className="cursor-pointer font-semibold">{taDate(d, true)}</summary>
              <div className="mt-3 space-y-3">
                {questions.some((q) => q.origin === "ca" && q.ca_date === d) && (
                  <button className="btn-ghost btn-sm" onClick={() => { const qs = questions.filter((q) => q.origin === "ca" && q.ca_date === d); begin({ kind: "ca", exam: null, unit_id: null, title: `நடப்பு நிகழ்வுகள் – ${d}`, qs, durationSec: qs.length * 54 }); }}>📝 இந்த நாளின் வினாக்கள் ({questions.filter((q) => q.origin === "ca" && q.ca_date === d).length})</button>
                )}
                <CaList items={meta.ca.filter((c) => c.ca_date === d)} />
              </div>
            </details>
          ))}
        </div>
      )}

      {tab === "cards" && meta && <Cards cards={meta.flashcards} />}
    </div>
  );
}

function Cards({ cards }: { cards: { id: string; front: string; back: string }[] }) {
  const [order] = useState(() => shuffle(cards));
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const c = order[i % Math.max(order.length, 1)];
  if (!c) return <p className="card">அட்டைகள் இல்லை.</p>;
  return (
    <div>
      <button onClick={() => setFlip(!flip)} className="card flex min-h-48 w-full flex-col items-center justify-center text-center">
        <p className="text-xs text-stone-400">{(i % order.length) + 1}/{order.length}</p>
        <p className={`mt-3 text-xl ${flip ? "text-brand-700" : ""}`}>{flip ? c.back : c.front}</p>
      </button>
      <button className="btn mt-3 w-full" onClick={() => { setFlip(false); setI(i + 1); }}>Next card</button>
    </div>
  );
}
