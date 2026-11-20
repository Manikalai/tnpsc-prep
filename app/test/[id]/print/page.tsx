import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import AutoPrint from "@/components/AutoPrint";

export const dynamic = "force-dynamic";

// Printable question paper / answer key for any test. Opened from the test or result page; the phone's
// "Save as PDF" (or a printer) turns it into a PDF — Tamil prints exactly as on screen.
const L = ["A", "B", "C", "D"];

export default async function PrintTest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ part?: string; auto?: string }> }) {
  const { id } = await params;
  const { part = "paper", auto } = await searchParams;
  const { sb, user } = await requireUser();
  const { data: test } = await sb.from("tests").select("id,title,kind,exam_code,question_ids,duration_sec,started_at").eq("id", id).eq("user_id", user.id).single();
  if (!test) notFound();
  const { data: qs } = await sb.from("questions").select("id,stem,options,answer_index,explanation,source_ref").in("id", test.question_ids);
  const map = new Map((qs ?? []).map((q) => [q.id, q]));
  const questions = (test.question_ids as string[]).map((qid) => map.get(qid)).filter(Boolean) as { id: string; stem: string; options: string[]; answer_index: number; explanation: string | null; source_ref: string | null }[];
  const mins = Math.round((test.duration_sec ?? questions.length * 54) / 60);
  const date = new Date(test.started_at ?? Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const showPaper = part === "paper" || part === "both";
  const showKey = part === "key" || part === "both";

  return (
    <div className="print-doc mx-auto max-w-3xl bg-white text-[15px] leading-relaxed text-black">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
        <AutoPrint auto={auto === "1"} />
        <Link href={`/test/${id}/print?part=paper`} className={`chip ${part === "paper" ? "!bg-maroon-600 !text-white" : ""}`}>Paper</Link>
        <Link href={`/test/${id}/print?part=key`} className={`chip ${part === "key" ? "!bg-maroon-600 !text-white" : ""}`}>Key</Link>
        <Link href={`/test/${id}/print?part=both`} className={`chip ${part === "both" ? "!bg-maroon-600 !text-white" : ""}`}>Both</Link>
        <p className="w-full text-xs text-stone-600">அச்சுத் திரையில் &quot;Save as PDF&quot; தேர்ந்தெடுத்தால் PDF ஆகச் சேமிக்கும்.</p>
      </div>

      {showPaper && (
        <section>
          <header className="mb-4 border-b-2 border-black pb-3 text-center">
            <p className="text-xs tracking-widest">SARANYA PREP · வெற்றி வேல்! வீர வேல்!</p>
            <h1 className="text-xl font-bold">{test.title}</h1>
            <p className="text-sm">வினாக்கள்: {questions.length} · நேரம்: {mins} நிமிடங்கள் · {date}</p>
            <p className="mt-1 text-xs">ஒவ்வொரு வினாவுக்கும் சரியான விடையை (A), (B), (C), (D) என வட்டமிடுக. விடை தெரியவில்லை எனில் (E).</p>
          </header>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={q.id} className="print-q">
                <p className="whitespace-pre-line font-medium"><span className="font-bold">{i + 1}.</span> {q.stem}</p>
                <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 pl-5 sm:grid-cols-2 print:grid-cols-2">
                  {q.options.map((o, j) => <p key={j}>({L[j]}) {o}</p>)}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-xs">— முற்றும் —</p>
        </section>
      )}

      {showKey && (
        <section className={showPaper ? "print-break" : ""}>
          <header className="mb-3 border-b-2 border-black pb-2 text-center">
            <h2 className="text-lg font-bold">விடைக் குறிப்பு · {test.title}</h2>
          </header>
          <div className="grid grid-cols-5 gap-1 text-center text-sm sm:grid-cols-10 print:grid-cols-10">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded border border-stone-400 py-1"><span className="text-stone-500">{i + 1}.</span> <b>{L[q.answer_index]}</b></div>
            ))}
          </div>
          <h3 className="mb-2 mt-5 font-bold">விளக்கங்கள்</h3>
          <ol className="space-y-2 text-[14px]">
            {questions.map((q, i) => (
              <li key={q.id} className="print-q">
                <b>{i + 1}. ({L[q.answer_index]}) {q.options[q.answer_index]}</b>
                {q.explanation && <span> — {q.explanation}</span>}
                {q.source_ref && <span className="text-stone-500"> [{q.source_ref}]</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
