import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { loadExam } from "@/lib/exam";
import { OPT, taDate } from "@/lib/format";
import ExamTabs from "@/components/ExamTabs";
import StartButton from "@/components/StartButton";
import PyqImport from "@/components/PyqImport";
import JobStatus from "@/components/JobStatus";

export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const sp = await searchParams;
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const code = sp.exam ?? profile.target_exam;
  const { units } = await loadExam(sb, code);
  const [{ data: counts }, { data: flagged }, { data: runs }, { count: chunks }] = await Promise.all([
    sb.from("bank_counts").select("*"),
    sb.from("questions").select("id,stem,options,answer_index,explanation,source_ref,verify_note,origin,pyq_year").eq("status", "flagged").limit(60),
    sb.from("job_runs").select("*").order("ran_at", { ascending: false }).limit(8),
    sb.from("textbook_chunks").select("*", { count: "exact", head: true }),
  ]);
  const { data: reports } = flagged?.length ? await sb.from("question_reports").select("question_id,reason").in("question_id", flagged.map((f) => f.id)) : { data: [] };
  const per = new Map<string, Record<string, number>>();
  for (const c of counts ?? []) {
    if (!c.unit_id) continue;
    const m = per.get(c.unit_id) ?? {};
    m[c.origin] = c.n;
    per.set(c.unit_id, m);
  }

  return (
    <div className="space-y-4">
      <JobStatus sb={sb} />
      <div className="card text-sm">
        <p>ஏற்றப்பட்ட பாடநூல் பகுதிகள்: <b>{chunks ?? 0}</b> {chunks ? "" : "— பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை (README: textbooks)."}</p>
        <p className="muted mt-1">ஒவ்வொரு இரவும் தானியங்கிப் பணி ஒவ்வொரு அலகுக்கும் வினாக்களைச் சேர்க்கும். இங்கே கைமுறையாகவும் சேர்க்கலாம் (ஒரு முறைக்கு ~10).</p>
      </div>
      <ExamTabs base="/admin" current={code} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-stone-500"><th className="py-1">அலகு</th><th>தேவை</th><th>AI</th><th>முந்தைய ஆண்டு</th><th /></tr></thead>
          <tbody>
            {units.filter((u) => u.subject !== "aptitude" && u.subject !== "reasoning").map((u) => {
              const m = per.get(u.id) ?? {};
              const total = Object.values(m).reduce((s, n) => s + n, 0);
              return (
                <tr key={u.id} className="border-t border-stone-100">
                  <td className="py-1.5 pr-2">{u.name_ta}</td>
                  <td className={total >= u.questions * 3 ? "text-brand-600" : "text-kumkum-500"}>{u.questions}×3</td>
                  <td>{m.ai ?? 0}</td>
                  <td>{m.pyq ?? 0}</td>
                  <td className="text-right"><StartButton url="/api/bank" body={{ unitId: u.id }} label="+10" className="btn-ghost btn-sm" busyLabel="…" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted mt-2">திறனறிவு வினாக்கள் கணினியால் உருவாக்கப்படுவதால் வங்கி தேவையில்லை; மாதிரித் தேர்வில் அவற்றுக்கு AI வினாக்கள் பயன்படும்போது இங்கே சேர்க்கவும்.</p>
      </div>

      <PyqImport units={units.map((u) => ({ id: u.id, name: u.name_ta }))} />

      <div className="card">
        <h2 className="h2 mb-2">புகாரளிக்கப்பட்ட வினாக்கள் ({flagged?.length ?? 0})</h2>
        {(flagged ?? []).map((q) => (
          <div key={q.id} className="border-t border-stone-100 py-3 text-sm">
            <p className="font-medium">{q.stem}</p>
            <ol className="mt-1">{(q.options as string[]).map((o, k) => <li key={k} className={k === q.answer_index ? "font-bold text-brand-700" : ""}>{OPT[k]}) {o}</li>)}</ol>
            {q.source_ref && <p className="text-xs text-stone-500">📖 {q.source_ref}</p>}
            <p className="text-xs text-kumkum-500">
              {[q.verify_note && `சரிபார்க்க: ${q.verify_note}`, ...(reports ?? []).filter((r) => r.question_id === q.id).map((r) => `புகார்: ${r.reason}`)].filter(Boolean).join(" | ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((k) => (
                <StartButton key={k} url="/api/admin/question" body={{ id: q.id, action: "fix", answer_index: k, explanation: q.explanation }} label={`Answer ${OPT[k]}`} className="btn-ghost btn-sm" busyLabel="…" />
              ))}
              <StartButton url="/api/admin/question" body={{ id: q.id, action: "activate" }} label="Correct" className="btn-ghost btn-sm" busyLabel="…" />
              <StartButton url="/api/admin/question" body={{ id: q.id, action: "retire" }} label="Delete" className="btn-ghost btn-sm" busyLabel="…" />
            </div>
          </div>
        ))}
      </div>

      <div className="card text-sm">
        <h2 className="h2 mb-2">தானியங்கிப் பணிகள்</h2>
        {(runs ?? []).map((r) => (
          <p key={r.id} className={r.ok ? "" : "text-kumkum-500"}>
            {taDate(r.ran_at)} · {r.job} · {r.ok ? "✓" : "✗"} {r.detail?.notes != null ? `${r.detail.notes} குறிப்புகள், ${r.detail.mcqs} வினாக்கள்` : ""}{r.detail?.added != null ? `${r.detail.added} வினாக்கள்` : ""}{r.detail?.verified != null ? ` · சரிபார்ப்பு ${r.detail.verified} ✓ / ${r.detail.retired} நீக்கம்` : ""} {r.detail?.error ?? ""}
          </p>
        ))}
      </div>
    </div>
  );
}
