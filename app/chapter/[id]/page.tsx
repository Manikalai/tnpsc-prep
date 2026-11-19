import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { type Chapter, type Clean, type Facts, type Revision, type Summary } from "@/lib/chapters";
import BookPages from "@/components/BookPages";
import CleanNotes from "@/components/CleanNotes";
import BookBackPanel from "@/components/BookBack";
import type { BookBack } from "@/lib/bookback";
import Md from "@/components/Md";
import StartButton from "@/components/StartButton";
import RevealList from "@/components/RevealList";

export const dynamic = "force-dynamic";

const TABS = [
  ["text", "பாடநூல்"],
  ["clean", "எளிய குறிப்புகள்"],
  ["bookback", "புத்தக வினாக்கள்"],
  ["summary", "முக்கியக் குறிப்புகள்"],
  ["facts", "நாட்கள் · ஆளுமைகள் · உண்மைகள்"],
  ["mcq", "வினாக்கள்"],
  ["revision", "திருப்புதல் வினாக்கள்"],
] as const;

export default async function ChapterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "text" } = await searchParams;
  const { sb, user } = await requireUser();
  const { data: ch } = await sb.from("chapters").select("*").eq("id", Number(id)).single();
  if (!ch) notFound();
  const c = ch as Chapter;
  const [{ data: notes }, { data: siblings }, { data: qs }] = await Promise.all([
    sb.from("chapter_notes").select("kind,content").eq("chapter_id", c.id),
    sb.from("chapters").select("id,chapter_no,subject").eq("book", c.book).eq("subject", c.subject).order("chapter_no"),
    sb.from("questions").select("id").eq("chapter_id", c.id).eq("status", "active"),
  ]);
  const note = (k: string) => notes?.find((n) => n.kind === k)?.content;
  const idx = (siblings ?? []).findIndex((s) => s.id === c.id);
  const prev = siblings?.[idx - 1], next = siblings?.[idx + 1];
  const pdf = c.source_url ? `${c.source_url}#page=${c.page_from ?? 1}` : null;

  const { data: attempts } = qs?.length
    ? await sb.from("answers").select("correct").eq("user_id", user.id).in("question_id", qs.map((q) => q.id))
    : { data: [] as { correct: boolean }[] };
  const right = (attempts ?? []).filter((a) => a.correct).length;

  const Generate = ({ kind, label }: { kind: string; label: string }) => (
    <div className="card text-center">
      <p className="mb-3 text-sm text-stone-600">{label}</p>
      <StartButton url="/api/chapter" body={{ action: "notes", chapterId: c.id, kind }} label="உருவாக்கு" busyLabel="பாடத்திலிருந்து எழுதுகிறது… (30–50 வினாடி)" />
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
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/chapter/${c.id}?tab=${k}`} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</Link>
        ))}
      </div>

      {tab === "text" && <BookPages book={c.book} from={c.page_from} to={c.page_to} pdf={pdf} />}

      {tab === "bookback" && <BookBackPanel chapterId={c.id} title={c.title_ta} initial={(note("bookback") as BookBack | undefined) ?? null} />}

      {tab === "clean" && <CleanNotes chapterId={c.id} initial={(note("clean") as Clean | undefined) ?? null} />}

      {tab === "summary" && (note("summary") ? (
        <>
          <div className="card">
            <h2 className="h2 mb-2">முக்கியக் குறிப்புகள்</h2>
            <ol className="list-decimal space-y-1 pl-5">{(note("summary") as Summary).points.map((p, k) => <li key={k}>{p}</li>)}</ol>
          </div>
          <div className="card"><h2 className="h2 mb-2">சுருக்கம்</h2><Md text={(note("summary") as Summary).summary} /></div>
        </>
      ) : <Generate kind="summary" label="இந்தப் பாடத்தின் சுருக்கமும் முக்கியக் குறிப்புகளும் இன்னும் உருவாக்கப்படவில்லை." />)}

      {tab === "facts" && (note("facts") ? <FactsView f={note("facts") as Facts} /> : <Generate kind="facts" label="நாட்கள், ஆளுமைகள், உண்மைகள், கலைச்சொற்கள் பட்டியல் இன்னும் உருவாக்கப்படவில்லை." />)}

      {tab === "mcq" && (
        <div className="card space-y-2 text-center">
          <p>இந்தப் பாடத்தில் {qs?.length ?? 0} வினாக்கள் உள்ளன{attempts?.length ? ` · நீங்கள் ${right}/${attempts.length} சரி` : ""}.</p>
          <StartButton url="/api/chapter" body={{ action: "quiz", chapterId: c.id }} label="15 வினாக்கள் – தொடங்கு" busyLabel="வினாக்கள் தயாராகின்றன… (30 வினாடி வரை)" />
          <p className="muted">வினாக்கள் இந்தப் பாடத்தின் உரையிலிருந்து மட்டுமே; விடைகளில் பக்க எண் தரப்படும். தவறியவை திருப்புதல் பட்டியலில் சேரும்.</p>
        </div>
      )}

      {tab === "revision" && (note("revision") ? (
        <div className="space-y-3">
          <RevealList items={(note("revision") as Revision).items} />
          <StartButton url="/api/chapter" body={{ action: "cards", chapterId: c.id }} label="இவற்றை நினைவு அட்டைகளாகச் சேர்" className="btn-ghost" />
        </div>
      ) : <Generate kind="revision" label="குறுவினா–விடை வடிவில் திருப்புதல் வினாக்கள் இன்னும் உருவாக்கப்படவில்லை." />)}

      <div className="flex justify-between gap-2 pt-1">
        {prev ? <Link className="pill-nav" href={`/chapter/${prev.id}?tab=${tab}`}>‹ பாடம் {prev.chapter_no}</Link> : <span />}
        {next ? <Link className="pill-nav" href={`/chapter/${next.id}?tab=${tab}`}>பாடம் {next.chapter_no} ›</Link> : <span />}
      </div>
    </div>
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
