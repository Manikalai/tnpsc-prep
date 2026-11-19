import Link from "next/link";
import { notFound } from "next/navigation";
import { aptType } from "@/lib/aptitude";
import { aptTopic } from "@/lib/aptitude-topics";
import { requireUser } from "@/lib/supabase/server";
import AptitudeDrill from "@/components/AptitudeDrill";
import Md from "@/components/Md";
import PyqReveal from "@/components/PyqReveal";

export const dynamic = "force-dynamic";

const TABS = [
  ["learn", "1. கற்க"],
  ["understand", "2. புரிந்துகொள்"],
  ["practice", "3. பயிற்சி"],
  ["pyq", "4. முந்தைய வினாக்கள்"],
  ["master", "5. தேர்ச்சி"],
] as const;

export default async function AptPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { type } = await params;
  const { tab = "learn" } = await searchParams;
  const topic = aptTopic(type);
  if (!topic) {
    // older single-type pages
    const t = aptType(type);
    if (!t) notFound();
    return (
      <div className="space-y-4">
        <h1 className="h1">{t.name}</h1>
        <div className="card"><h2 className="h2">வழிமுறை</h2><ul className="mt-2 list-disc space-y-1 pl-5">{t.method.map((m, k) => <li key={k}>{m}</li>)}</ul></div>
        <AptitudeDrill keys={[t.key]} n={10} title={`${t.name} – 10 வினாக்கள்`} seconds={10 * 60} />
      </div>
    );
  }
  const { sb, user } = await requireUser();
  const shortcuts = topic.types.map((k) => aptType(k)).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <p className="muted">{topic.en}</p>
        <h1 className="h1">{topic.ta}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">{topic.syllabus.map((s) => <span key={s} className="chip">{s}</span>)}</div>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/aptitude/${topic.key}?tab=${k}`} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</Link>
        ))}
      </div>

      {tab === "learn" && (
        <>
          <section className="card reading"><Md text={topic.learn} /></section>
          <Link href={`/aptitude/${topic.key}?tab=understand`} className="btn w-full">அடுத்து: சூத்திரங்களும் எடுத்துக்காட்டுகளும் →</Link>
        </>
      )}

      {tab === "understand" && (
        <>
          <section className="card">
            <h2 className="h2 mb-2">சூத்திரங்கள் (Formulas)</h2>
            <div className="divide-y divide-stone-100">
              {topic.formulas.map((f) => (
                <div key={f.name} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between">
                  <span className="text-sm text-stone-600">{f.name}</span>
                  <span className="font-semibold text-brand-700">{f.f}</span>
                </div>
              ))}
            </div>
          </section>
          {topic.examples.map((e, k) => (
            <section key={k} className="card">
              <p className="font-semibold">எடுத்துக்காட்டு {k + 1}: {e.q}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-stone-50 p-2.5 text-[15px]">
                  <p className="mb-1 text-xs font-bold text-stone-500">சாதாரண முறை</p>
                  {e.normal.map((s, i) => <p key={i}>{s}</p>)}
                </div>
                <div className="rounded-xl bg-gold-400/15 p-2.5 text-[15px]">
                  <p className="mb-1 text-xs font-bold text-maroon-700">⚡ சுருக்கு வழி</p>
                  {e.shortcut.map((s, i) => <p key={i}>{s}</p>)}
                </div>
              </div>
              <p className="mt-2 font-semibold text-brand-700">விடை: {e.answer}</p>
            </section>
          ))}
          <section className="card">
            <h2 className="h2 mb-2">⚡ நினைவுக் குறிப்புகள் & கணக்குத் தந்திரங்கள்</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              {topic.hacks.map((h, k) => <li key={k}>{h}</li>)}
              {shortcuts.flatMap((t) => t!.shortcuts).map((h, k) => <li key={`s${k}`}>{h}</li>)}
            </ul>
            <Link href="/aptitude/shortcuts" className="mt-3 inline-block text-sm font-semibold text-brand-600 underline">முழு சுருக்கு வழி அட்டவணை →</Link>
          </section>
        </>
      )}

      {tab === "practice" && (
        <>
          <p className="muted">ஒவ்வொரு வினாவும் கணினியால் கணக்கிடப்படுகிறது — விடைகள் எப்போதும் சரியானவை. சமர்ப்பித்த பின் ஒவ்வொன்றுக்கும் விளக்கம் வரும்.</p>
          {topic.types.map((k) => {
            const t = aptType(k)!;
            return <AptitudeDrill key={k} keys={[k]} n={10} title={`${t.name} – 10 வினாக்கள்`} seconds={10 * 60} />;
          })}
          {topic.types.length > 1 && <AptitudeDrill keys={topic.types} n={15} title={`${topic.ta} – கலப்பு 15`} seconds={15 * 60} />}
        </>
      )}

      {tab === "pyq" && <Pyq sbTopic={topic.key} />}

      {tab === "master" && (
        <>
          <p className="muted">தேர்வு வேகம்: ஒரு வினாவுக்கு சுமார் 36 வினாடி (200 வினா / 3 மணி — மற்ற பகுதிகளுக்கும் நேரம் வேண்டும்).</p>
          <AptitudeDrill keys={topic.types} n={15} title={`${topic.ta} – தேர்ச்சித் தேர்வு`} seconds={15 * 36} />
          <History userId={user.id} sb={sb} types={topic.types} />
        </>
      )}
    </div>
  );
}

async function Pyq({ sbTopic }: { sbTopic: string }) {
  const { sb } = await requireUser();
  const { data } = await sb.from("questions").select("id,stem,options,answer_index,explanation,exam_code,pyq_year").eq("origin", "pyq").eq("style", `apt:${sbTopic}`).eq("status", "active").order("pyq_year", { ascending: false }).limit(200);
  if (!data?.length)
    return <p className="card text-sm">இந்தத் தலைப்பின் உண்மையான TNPSC வினாக்கள் இன்னும் சேர்க்கப்படவில்லை. முந்தைய ஆண்டு வினாத்தாள்கள் ஒவ்வொன்றாகச் சரிபார்த்துச் சேர்க்கப்படுகின்றன (குரூப் 4: 2025, 2024, 2022, 2019 …).</p>;
  return <PyqReveal items={data as never} />;
}

async function History({ sb, userId, types }: { sb: Awaited<ReturnType<typeof requireUser>>["sb"]; userId: string; types: string[] }) {
  const { data } = await sb.from("tests").select("title,score,max_score,submitted_at,result").eq("user_id", userId).eq("kind", "aptitude").order("submitted_at", { ascending: false }).limit(60);
  const rows = (data ?? []).filter((t) => ((t.result as { types?: string[] })?.types ?? []).some((k) => types.includes(k))).slice(0, 12);
  if (!rows.length) return <p className="card text-sm">இன்னும் பயிற்சி செய்யவில்லை. மேலே உள்ள தேர்வைத் தொடங்குங்கள்.</p>;
  const acc = rows.reduce((s, r) => s + Number(r.score), 0) / Math.max(1, rows.reduce((s, r) => s + Number(r.max_score), 0));
  return (
    <section className="card">
      <h2 className="h2 mb-1">உங்கள் முன்னேற்றம்</h2>
      <p className="muted mb-2">சராசரி துல்லியம் {Math.round(acc * 100)}%</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-stone-500"><th className="py-1">தேதி</th><th>மதிப்பெண்</th><th>துல்லியம்</th><th>நேரம்/வினா</th></tr></thead>
        <tbody>
          {rows.map((r, k) => {
            const res = r.result as { elapsedSec?: number; total?: number };
            return (
              <tr key={k} className="border-t border-stone-100">
                <td className="py-1.5">{new Date(r.submitted_at).toLocaleDateString("ta-IN", { day: "numeric", month: "short" })}</td>
                <td>{Number(r.score)}/{Number(r.max_score)}</td>
                <td>{Math.round((Number(r.score) / Math.max(1, Number(r.max_score))) * 100)}%</td>
                <td>{res?.elapsedSec && res.total ? `${Math.round(res.elapsedSec / res.total)} வி` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
