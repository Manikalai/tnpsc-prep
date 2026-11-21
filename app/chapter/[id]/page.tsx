import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { mindMapCards, type Chapter, type Clean, type Facts, type Hacks, type MindMap as MM, type Revision, type Summary } from "@/lib/chapters";
import MindMap from "@/components/MindMap";
import AddCards from "@/components/AddCards";
import Emoji from "@/components/Emoji";
import BookPages from "@/components/BookPages";
import CleanNotes from "@/components/CleanNotes";
import BookBackPanel from "@/components/BookBack";
import type { BookBack } from "@/lib/bookback";
import Md from "@/components/Md";
import StartButton from "@/components/StartButton";
import RevealList from "@/components/RevealList";
import LessonTabs from "@/components/LessonTabs";
import ListenButton from "@/components/ListenButton";

export const dynamic = "force-dynamic";

const TABS = [
  ["text", "Textbook"],
  ["clean", "Easy notes"],
  ["bookback", "Book-back"],
  ["summary", "Key points"],
  ["facts", "Dates · People · Facts"],
  ["mindmap", "🗺️ Mind map"],
  ["hacks", "🧠 Memory hacks"],
  ["mcq", "MCQs"],
  ["revision", "Revision Q&A"],
] as const;

export default async function ChapterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "text" } = await searchParams;
  const { sb, user } = await requireUser();
  const cid = Number(id);
  const [{ data: ch }, { data: notes }, { data: qs }] = await Promise.all([
    sb.from("chapters").select("*").eq("id", cid).single(),
    sb.from("chapter_notes").select("kind,content").eq("chapter_id", cid),
    sb.from("questions").select("id").eq("chapter_id", cid).eq("status", "active"),
  ]);
  if (!ch) notFound();
  const c = ch as Chapter;
  const [{ data: siblings }, { data: attempts }] = await Promise.all([
    sb.from("chapters").select("id,chapter_no,subject").eq("book", c.book).eq("subject", c.subject).order("chapter_no"),
    qs?.length
      ? sb.from("answers").select("correct").eq("user_id", user.id).in("question_id", qs.map((q) => q.id))
      : Promise.resolve({ data: [] as { correct: boolean }[] }),
  ]);
  const note = (k: string) => notes?.find((n) => n.kind === k)?.content;
  const idx = (siblings ?? []).findIndex((s) => s.id === c.id);
  const prev = siblings?.[idx - 1], next = siblings?.[idx + 1];
  const pdf = c.source_url ? `${c.source_url}#page=${c.page_from ?? 1}` : null;

  const right = (attempts ?? []).filter((a) => a.correct).length;

  const Generate = ({ kind, label }: { kind: string; label: string }) => (
    <div className="card text-center">
      <p className="mb-3 text-sm text-stone-600">{label}</p>
      <StartButton url="/api/chapter" body={{ action: "notes", chapterId: c.id, kind }} label="Generate" busyLabel="Writing from the lesson… (30–50 sec)" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="muted">{c.book}{c.term ? ` · பருவம் ${c.term}` : ""}</p>
        <h1 className="h1">பாடம் {c.chapter_no}: {c.title_ta}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="chip">பக்கம் {c.page_from}–{c.page_to}</span>
          {pdf && <a href={pdf} target="_blank" rel="noreferrer" className="chip bg-brand-50 text-brand-700">PDF ↗</a>}
        </div>
      </div>
      <LessonTabs
        chapterId={c.id}
        tabs={TABS}
        initial={TABS.some(([k]) => k === tab) ? tab : "text"}
        prev={prev ? { href: `/chapter/${prev.id}`, label: `‹ Lesson ${prev.chapter_no}` } : undefined}
        next={next ? { href: `/chapter/${next.id}`, label: `Lesson ${next.chapter_no} ›` } : undefined}
        panels={{
        text: (<BookPages book={c.book} from={c.page_from} to={c.page_to} pdf={pdf} />),
        bookback: (<BookBackPanel chapterId={c.id} title={c.title_ta} initial={(note("bookback") as BookBack | undefined) ?? null} />),
        clean: (<><ListenButton target="ln-clean" /><div id="ln-clean"><CleanNotes chapterId={c.id} initial={(note("clean") as Clean | undefined) ?? null} /></div></>),
        summary: ((note("summary") ? (
        <>
          <ListenButton target="ln-summary" />
          <div id="ln-summary" className="space-y-4"><div className="card">
            <h2 className="h2 mb-2">முக்கியக் குறிப்புகள்</h2>
            <ol className="list-decimal space-y-1 pl-5">{(note("summary") as Summary).points.map((p, k) => <li key={k}>{p}</li>)}</ol>
          </div>
          <div className="card"><h2 className="h2 mb-2">சுருக்கம்</h2><Md text={(note("summary") as Summary).summary} /></div></div>
        </>
      ) : <Generate kind="summary" label="இந்தப் பாடத்தின் சுருக்கமும் முக்கியக் குறிப்புகளும் இன்னும் உருவாக்கப்படவில்லை." />)),
        facts: ((note("facts") ? <><ListenButton target="ln-facts" /><div id="ln-facts" className="space-y-4"><FactsView f={note("facts") as Facts} /></div></> : <Generate kind="facts" label="நாட்கள், ஆளுமைகள், உண்மைகள், கலைச்சொற்கள் பட்டியல் இன்னும் உருவாக்கப்படவில்லை." />)),
        mcq: ((
        <div className="card space-y-2 text-center">
          <p>இந்தப் பாடத்தில் {qs?.length ?? 0} வினாக்கள் உள்ளன{attempts?.length ? ` · நீங்கள் ${right}/${attempts.length} சரி` : ""}.</p>
          <StartButton url="/api/chapter" body={{ action: "quiz", chapterId: c.id }} label="Start 15 questions" busyLabel="Preparing questions… (up to 30 sec)" />
          <p className="muted">வினாக்கள் இந்தப் பாடத்தின் உரையிலிருந்து மட்டுமே; விடைகளில் பக்க எண் தரப்படும். தவறியவை திருப்புதல் பட்டியலில் சேரும்.</p>
        </div>
      )),
        mindmap: ((note("mindmap") && (note("mindmap") as MM).branches?.length ? (
          <>
            <ListenButton target="ln-mindmap-text" />
            <MindMap m={note("mindmap") as MM} />
            <div id="ln-mindmap-text" className="hidden">{(note("mindmap") as MM).root}. {(note("mindmap") as MM).branches.map((b) => `${b.t}: ${(b.c ?? []).map((n) => n.t).join(", ")}.`).join(" ")}</div>
            <AddCards cards={mindMapCards(note("mindmap") as MM)} label="Add branches as flashcards" />
          </>
        ) : <Generate kind="mindmap" label="இந்தப் பாடத்தின் மன வரைபடம் இன்னும் உருவாக்கப்படவில்லை." />)),
        hacks: ((note("hacks") ? <HacksView h={note("hacks") as Hacks} /> : <Generate kind="hacks" label="இந்தப் பாடத்தின் நினைவு உத்திகள் (முதல் எழுத்துக் குறியீடு, கதை, எண் குறிப்பு) இன்னும் உருவாக்கப்படவில்லை." />)),
        revision: ((note("revision") ? (
        <div className="space-y-3">
          <RevealList items={(note("revision") as Revision).items} />
          <StartButton url="/api/chapter" body={{ action: "cards", chapterId: c.id }} label="Add these as flashcards" className="btn-ghost" />
        </div>
      ) : <Generate kind="revision" label="குறுவினா–விடை வடிவில் திருப்புதல் வினாக்கள் இன்னும் உருவாக்கப்படவில்லை." />)),
        }}
      />
    </div>
  );
}

const HACK_ICON: Record<string, string> = { acronym: "🔤", story: "📖", number: "🔢", link: "🔗", rhyme: "🎵" };
function HacksView({ h }: { h: Hacks }) {
  if (!h.items?.length) return <p className="card muted">இந்தப் பாடத்துக்குச் சரிபார்க்கப்பட்ட உத்திகள் இல்லை.</p>;
  return (
    <>
      <ListenButton target="ln-hacks" />
      <div id="ln-hacks" className="space-y-2.5">
        {h.items.map((x, k) => (
          <div key={k} className="card !p-4">
            <p className="text-[15px] font-semibold leading-relaxed">{x.fact}</p>
            <div className="mt-2 flex gap-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 ring-1 ring-amber-200/70">
              <span className="text-lg leading-none">{HACK_ICON[x.type] ?? "🧠"}</span>
              <p className="text-[15px] leading-relaxed text-maroon-700">{x.hack}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2"><Emoji name="brain" size={26} /><AddCards cards={h.items.map((x) => ({ front: x.hack, back: x.fact }))} label="Add these as flashcards" /></div>
    </>
  );
}

function FactsView({ f }: { f: Facts }) {
  return (
    <div className="space-y-3">
      {!!f.dates?.length && (
        <div className="card overflow-x-auto">
          <h2 className="h2 mb-2">முக்கிய நாட்கள் / ஆண்டுகள்</h2>
          <table className="w-full text-sm"><tbody>{f.dates.map((d, k) => <tr key={k} className="border-t border-stone-100"><td className="whitespace-nowrap py-1.5 pr-3 align-top font-semibold text-brand-700">{d.date}</td><td>{d.event}</td></tr>)}</tbody></table>
        </div>
      )}
      {!!f.persons?.length && (
        <div className="card">
          <h2 className="h2 mb-2">ஆளுமைகள்</h2>
          <ul className="space-y-1">{f.persons.map((p, k) => <li key={k}><b>{p.name}</b> — {p.about}</li>)}</ul>
        </div>
      )}
      {!!f.facts?.length && (
        <div className="card">
          <h2 className="h2 mb-2">முக்கிய உண்மைகள்</h2>
          <ul className="list-disc space-y-1 pl-5">{f.facts.map((x, k) => <li key={k}>{x}</li>)}</ul>
        </div>
      )}
      {!!f.terms?.length && (
        <div className="card">
          <h2 className="h2 mb-2">கலைச்சொற்கள்</h2>
          <ul className="space-y-1">{f.terms.map((t, k) => <li key={k}><b>{t.term}</b> — {t.meaning}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
