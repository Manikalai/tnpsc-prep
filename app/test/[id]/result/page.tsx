import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { OPT, pct } from "@/lib/format";
import ReportButton from "@/components/ReportButton";

type Row = { id: string; name: string; correct: number; total: number; attempted: number; marks?: number; max?: number; gate?: number | null };

export default async function Result({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ only?: string }> }) {
  const { id } = await params;
  const { only } = await searchParams;
  const { sb, user } = await requireUser();
  const { data: test } = await sb.from("tests").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!test || !test.submitted_at) notFound();
  const r = test.result as { correct: number; attempted: number; total: number; parts: Row[]; units: Row[]; gatePassed: boolean | null; elapsedSec?: number };
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
      <div className="card">
        <p className="muted">{test.title}</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="text-4xl font-bold text-brand-700">
            {Number(test.score)}<span className="text-xl text-stone-400">/{Number(test.max_score)}</span>
          </p>
          <p className="text-stone-600">சரி {r.correct} · தவறு {r.attempted - r.correct} · விடையில்லை {r.total - r.attempted}</p>
          {r.elapsedSec ? <p className="muted">நேரம் {Math.round(r.elapsedSec / 60)} நிமிடம்</p> : null}
        </div>
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
        <Link className={only === "wrong" ? "btn-ghost btn-sm" : "btn btn-sm"} href={`/test/${id}/result`}>எல்லா வினாக்களும்</Link>
        <Link className={only === "wrong" ? "btn btn-sm" : "btn-ghost btn-sm"} href={`/test/${id}/result?only=wrong`}>தவறியவை / விடையில்லாதவை</Link>
        <Link className="btn-ghost btn-sm" href="/revision">திருப்புதல் பட்டியல்</Link>
      </div>

      <div className="space-y-3">
        {shown.map(({ n, q, a }) => (
          <div key={q!.id} className="card">
            <p className="text-xs text-stone-400">வினா {n} {q!.origin === "pyq" && <span className="chip ml-1">முந்தைய ஆண்டு {q!.pyq_year ?? ""}</span>}</p>
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
            {a?.chosen == null && <p className="mt-1 text-xs text-stone-500">விடையளிக்கவில்லை</p>}
            {q!.explanation && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">{q!.explanation}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <span>{q!.source_ref ? `ஆதாரம்: ${q!.source_ref}` : q!.origin === "ai" ? "⚠ பாடநூல் ஆதாரம் இல்லை – சரிபார்க்கவும்" : ""}</span>
              <ReportButton questionId={q!.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
