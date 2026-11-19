"use client";
// Books tree and lesson view (text, key points, facts, revision, quiz) from the phone's storage.
import { useEffect, useState } from "react";
import { idb } from "@/lib/offline-db";
import type { OfflineMeta } from "@/lib/offline-sync";
import type { OQ } from "@/lib/offline-score";
import type { Clean, Facts, Revision, Summary } from "@/lib/chapters";
import BookPages from "@/components/BookPages";
import { CleanView } from "@/components/CleanNotes";
import { BookBackView } from "@/components/BookBack";
import type { BookBack } from "@/lib/bookback";
import Md from "@/components/Md";
import RevealList from "@/components/RevealList";

const SUBJECT: Record<string, string> = { tamil: "தமிழ்", social: "சமூக அறிவியல்", science: "அறிவியல்" };
type Ch = OfflineMeta["chapters"][number];

export default function OfflineBooks({ meta, stds, questions, onQuiz }: { meta: OfflineMeta; stds: number[]; questions: OQ[]; onQuiz: (id: number, title: string) => void }) {
  const [std, setStd] = useState(stds[0] ?? 6);
  const [open, setOpen] = useState<Ch | null>(null);
  if (open) return <Lesson ch={open} meta={meta} questions={questions} onBack={() => setOpen(null)} onOpen={setOpen} onQuiz={onQuiz} />;
  const inStd = meta.chapters.filter((c) => c.std === std);
  const terms = [...new Set(inStd.map((c) => c.term ?? ""))].sort();
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto">
        {stds.map((s) => (
          <button key={s} onClick={() => setStd(s)} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${s === std ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{s}ஆம் வகுப்பு</button>
        ))}
      </div>
      {terms.map((t) => (
        <div key={t} className="space-y-2">
          {t && <h2 className="font-bold text-brand-700">பருவம் {t}</h2>}
          {["tamil", "social", "science"].map((s) => {
            const list = inStd.filter((c) => (c.term ?? "") === t && c.subject === s);
            if (!list.length) return null;
            return (
              <details key={s} className="card">
                <summary className="cursor-pointer font-semibold">{SUBJECT[s]} <span className="text-xs font-normal text-stone-400">{list.length} பாடங்கள்</span></summary>
                <ul className="mt-2 divide-y divide-stone-100">
                  {list.map((c) => (
                    <li key={c.id}><button className="w-full py-2 text-left hover:text-brand-600" onClick={() => setOpen(c)}>{c.chapter_no}. {c.title_ta}</button></li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Lesson({ ch, meta, questions, onBack, onOpen, onQuiz }: { ch: Ch; meta: OfflineMeta; questions: OQ[]; onBack: () => void; onOpen: (c: Ch) => void; onQuiz: (id: number, title: string) => void }) {
  const [tab, setTab] = useState("text");
  const [notes, setNotes] = useState<Record<string, unknown>>({});
  useEffect(() => {
    (async () => {
      const n: Record<string, unknown> = {};
      for (const k of ["clean", "bookback", "summary", "facts", "revision"]) {
        const v = await idb.getOne<{ content: unknown }>("chnotes", `${ch.id}:${k}`);
        if (v) n[k] = v.content;
      }
      setNotes(n);
    })();
    window.scrollTo(0, 0);
  }, [ch.id]);
  const siblings = meta.chapters.filter((c) => c.book === ch.book && c.subject === ch.subject);
  const idx = siblings.findIndex((c) => c.id === ch.id);
  const nq = questions.filter((q) => q.chapter_id === ch.id).length;
  const missing = <p className="card text-sm">இன்னும் உருவாக்கப்படவில்லை — இணையத்தில் இருக்கும்போது பாடநூல்கள் பகுதியில் உருவாக்கவும் அல்லது இரவுப் பணிக்குப் பிறகு புதுப்பிக்கவும்.</p>;
  const f = notes.facts as Facts | undefined;
  return (
    <div className="space-y-3">
      <button className="text-sm underline" onClick={onBack}>← பாடநூல்கள்</button>
      <div><p className="muted">{ch.book}{ch.term ? ` · பருவம் ${ch.term}` : ""}</p><h2 className="h1">பாடம் {ch.chapter_no}: {ch.title_ta}</h2></div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {[["text", "பாடநூல்"], ["clean", "எளிய குறிப்புகள்"], ["bookback", "புத்தக வினாக்கள்"], ["summary", "முக்கியக் குறிப்புகள்"], ["facts", "நாட்கள் · ஆளுமைகள்"], ["mcq", "வினாக்கள்"], ["revision", "திருப்புதல்"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>
      {tab === "text" && <BookPages book={ch.book} from={ch.page_from} to={ch.page_to} />}
      {tab === "bookback" && (notes.bookback ? <BookBackView data={notes.bookback as BookBack} /> : missing)}
      {tab === "clean" && (notes.clean ? <CleanView clean={notes.clean as Clean} /> : missing)}
      {tab === "summary" && (notes.summary ? (
        <>
          <div className="card"><ol className="list-decimal space-y-1 pl-5">{(notes.summary as Summary).points.map((p, k) => <li key={k}>{p}</li>)}</ol></div>
          <div className="card"><Md text={(notes.summary as Summary).summary} /></div>
        </>
      ) : missing)}
      {tab === "facts" && (f ? (
        <div className="card space-y-3 text-sm">
          {!!f.dates?.length && <div><b>நாட்கள்</b>{f.dates.map((d, k) => <p key={k}><span className="whitespace-nowrap font-semibold text-brand-700">{d.date}</span> — {d.event}</p>)}</div>}
          {!!f.persons?.length && <div><b>ஆளுமைகள்</b>{f.persons.map((p, k) => <p key={k}><b>{p.name}</b> — {p.about}</p>)}</div>}
          {!!f.facts?.length && <div><b>உண்மைகள்</b><ul className="list-disc pl-5">{f.facts.map((x, k) => <li key={k}>{x}</li>)}</ul></div>}
          {!!f.terms?.length && <div><b>கலைச்சொற்கள்</b>{f.terms.map((t, k) => <p key={k}><b>{t.term}</b> — {t.meaning}</p>)}</div>}
        </div>
      ) : missing)}
      {tab === "mcq" && (
        <div className="card text-center">
          <p className="mb-2">சேமித்த வினாக்கள்: {nq}</p>
          <button className="btn" disabled={!nq} onClick={() => onQuiz(ch.id, `${ch.book} – பாடம் ${ch.chapter_no}: ${ch.title_ta}`)}>15 வினாக்கள் – தொடங்கு</button>
        </div>
      )}
      {tab === "revision" && (notes.revision ? <RevealList items={(notes.revision as Revision).items} /> : missing)}
      <div className="flex justify-between text-sm">
        {siblings[idx - 1] ? <button className="underline" onClick={() => onOpen(siblings[idx - 1])}>← பாடம் {siblings[idx - 1].chapter_no}</button> : <span />}
        {siblings[idx + 1] ? <button className="underline" onClick={() => onOpen(siblings[idx + 1])}>பாடம் {siblings[idx + 1].chapter_no} →</button> : <span />}
      </div>
    </div>
  );
}
