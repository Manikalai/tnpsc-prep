import { Vel } from "@/components/Murugan";
import { blessing } from "@/lib/murugan";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { OPT, pct } from "@/lib/format";
import ReportButton from "@/components/ReportButton";
import Emoji from "@/components/Emoji";
import ExplainButton from "@/components/ExplainButton";

type Row = { id: string; name: string; correct: number; total: number; attempted: number; marks?: number; max?: number; gate?: number | null };

export default async function Result({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ only?: string }> }) {
  const { id } = await params;
  const { only } = await searchParams;
  const { sb, user } = await requireUser();
  const { data: test } = await sb.from("tests").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!test || !test.submitted_at) notFound();
  const r = test.result as { correct: number; attempted: number; total: number; notKnown?: number; blank?: number; parts: Row[]; units: Row[]; gatePassed: boolean | null; elapsedSec?: number };
  const [{ data: qs }, { data: ans }] = await Promise.all([
    sb.from("questions").select("*").in("id", test.question_ids),
    sb.from("answers").select("question_id,chosen,correct").eq("test_id", id),
  ]);
  const qmap = new Map((qs ?? []).map((q) => [q.id, q]));
  const amap = new Map((ans ?? []).map((a) => [a.question_id, a]));
  const list = (test.question_ids as string[]).map((qid, n) => ({ n: n + 1, q: qmap.get(qid), a: amap.get(qid) })).filter((x) => x.q);
  const shown = only === "wrong" ? list.filter((x) => !x.a?.correct) : list;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon-700 via-maroon-500 to-saffron-500 p-4 text-white shadow">
        <Vel className="absolute -right-1 bottom-0 h-28 opacity-30" />
        {(() => {
          const pc = (Number(test.score) / Math.max(1, Number(test.max_score))) * 100;
          return (
            <div className="relative flex items-center gap-3">
              <Emoji name={pc >= 80 ? "trophy" : pc >= 60 ? "star" : pc >= 40 ? "muscle" : "diya"} size={52} />
              <p className="text-[17px] font-bold text-gold-400">{blessing(pc)}</p>
            </div>
          );
        })()}
      </div>
      <div className="card">
        <p className="muted">{test.title}</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="text-4xl font-bold text-brand-700">
            {Number(test.score)}<span className="text-xl text-stone-400">/{Number(test.max_score)}</span>
          </p>
          <p className="text-stone-600">சரி {r.correct} · தவறு {r.attempted - r.correct} · (E) தெரியவில்லை {r.notKnown ?? 0} · குறிக்கவில்லை {r.blank ?? r.total - r.attempted}</p>
          {r.elapsedSec ? <p className="muted">நேரம் {Math.round(r.elapsedSec / 60)} நிமிடம்</p> : null}
        </div>
        {(r.blank ?? 0) > 0 && test.kind === "mock" && (
          <p className="mt-3 rounded-xl bg-kumkum-50 p-3 text-sm text-kumkum-500">
            {r.blank} வினாக்களில் எதுவும் குறிக்கவில்லை. உண்மைத் தேர்வில் இதனால் விடைத்தாள் செல்லாததாகும் — தெரியாதவற்றுக்கு (E) குறிக்கப் பழகுங்கள்.
          </p>
        )}
        {r.gatePassed === false && (
          <p className="mt-3 rounded-xl bg-kumkum-50 p-3 text-sm text-kumkum-500">
            தமிழ்ப் பகுதியில் தகுதி மதிப்பெண் (60/150) கிடைக்கவில்லை. உண்மைத் தேர்வில் மற்ற பகுதிகள் மதிப்பீடு செய்யப்படாது — தமிழுக்கு முன்னுரிமை கொடுங்கள்.
          </p>
        )}
        {r.gatePassed === true && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">தமிழ்ப் பகுதி தகுதி மதிப்பெண் பெற்றீர்கள் ✓</p>}
      </div>

      {r.parts?.length > 0 && (
        <div className="card">
          <h2 className="h2 mb-2">பகுதி வாரியாக</h2>
          {r.parts.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-stone-100 py-2 last:border-0">
              <span>{p.name}</span>
              <span className="font-semibold">{p.marks}/{p.max} <span className="text-xs text-stone-400">({p.correct}/{p.total})</span></span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="h2 mb-2">அலகு வாரியாக</h2>
        {r.units.map((u) => {
          const p = pct(u.correct, u.total);
          return (
            <div key={u.id} className="py-1.5">
              <div className="flex justify-between text-sm"><span>{u.name}</span><span className="font-semibold">{u.correct}/{u.total}</span></div>
              <div className="mt-1 h-2 rounded-full bg-stone-100"><div className={`h-2 rounded-full ${p >= 70 ? "bg-brand-500" : p >= 40 ? "bg-turmeric-500" : "bg-kumkum-500"}`} style={{ width: `${p}%` }} /></div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className={only === "wrong" ? "btn-ghost btn-sm" : "btn btn-sm"} href={`/test/${id}/result`}>All questions</Link>
        <Link className={only === "wrong" ? "btn btn-sm" : "btn-ghost btn-sm"} href={`/test/${id}/result?only=wrong`}>Wrong / unanswered</Link>
        <Link className="btn-ghost btn-sm" href="/revision">Revision list</Link>
        <Link className="btn-ghost btn-sm" href={`/test/${id}/print?part=both&auto=1`}>📄 Paper + key PDF</Link>
      </div>

      <div className="space-y-3">
        {shown.map(({ n, q, a }) => (
          <div key={q!.id} className="card">
            <p className="text-xs text-stone-400">
              வினா {n} {q!.origin === "pyq" && <span className="chip ml-1">முந்தைய ஆண்டு {q!.pyq_year ?? ""}</span>}
              {q!.verified === "ok" && <span className="chip ml-1 bg-brand-50 text-brand-700">✓ பாடநூலுடன் சரிபார்க்கப்பட்டது</span>}
              {q!.difficulty && <span className="chip ml-1">{({ easy: "எளிது", medium: "நடுத்தரம்", hard: "கடினம்" } as Record<string, string>)[q!.difficulty] ?? q!.difficulty}</span>}
            </p>
            <p className="mt-1 whitespace-pre-line font-medium">{q!.stem}</p>
            <div className="mt-2 space-y-1">
              {(q!.options as string[]).map((o, k) => {
                const right = k === q!.answer_index, picked = a?.chosen === k;
                return (
                  <div key={k} className={`rounded-lg px-3 py-1.5 text-sm ${right ? "bg-brand-50 font-semibold text-brand-700" : picked ? "bg-kumkum-50 text-kumkum-500 line-through" : ""}`}>
                    {OPT[k]}) {o} {right && "✓"} {picked && !right && "✗"}
                  </div>
                );
              })}
            </div>
            {a?.chosen == null && <p className="mt-1 text-xs text-kumkum-500">எதுவும் குறிக்கவில்லை</p>}
            {a?.chosen === 4 && <p className="mt-1 text-xs text-stone-500">(E) விடை தெரியவில்லை எனக் குறித்தீர்கள்</p>}
            {q!.explanation && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">{q!.explanation}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <span>{q!.source_ref ? `📖 ${q!.source_ref}` : q!.origin === "ai" ? "⚠ பாடநூல் ஆதாரம் இல்லை (பழைய வினா – விரைவில் நீக்கப்படும்)" : ""}</span>
              <ReportButton questionId={q!.id} />
            </div>
            <div className="mt-1"><ExplainButton questionId={q!.id} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
