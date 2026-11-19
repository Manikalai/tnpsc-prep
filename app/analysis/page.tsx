import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { loadExam } from "@/lib/exam";
import { pct } from "@/lib/format";
import ExamTabs from "@/components/ExamTabs";

export const dynamic = "force-dynamic";

export default async function Analysis({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const sp = await searchParams;
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const code = sp.exam ?? profile.target_exam;
  const { units } = await loadExam(sb, code);
  const [{ data: acc }, { data: pyq }] = await Promise.all([
    sb.from("unit_accuracy").select("*").eq("user_id", user.id),
    sb.from("questions").select("unit_id,pyq_year").eq("origin", "pyq").eq("exam_code", code).limit(5000),
  ]);
  const accMap = new Map((acc ?? []).map((a) => [a.unit_id, a]));
  const years = [...new Set((pyq ?? []).map((q) => q.pyq_year).filter(Boolean))].sort() as number[];
  const pyqCount = (u: string, y?: number) => (pyq ?? []).filter((q) => q.unit_id === u && (y == null || q.pyq_year === y)).length;

  const rows = units.map((u) => {
    const a = accMap.get(u.id);
    const accuracy = a ? pct(a.correct, a.attempted) : null;
    // priority: weight in the paper × how weak you are
    const priority = Math.round(u.questions * (1 - (accuracy ?? 30) / 100) * 10) / 10;
    return { u, a, accuracy, priority };
  });
  const weak = [...rows].filter((r) => r.u.subject).sort((x, y) => y.priority - x.priority).slice(0, 5);

  return (
    <div className="space-y-4">
      <ExamTabs base="/analysis" current={code} />
      <div className="card">
        <h2 className="h2">முதலில் கவனிக்க வேண்டியவை</h2>
        <p className="muted">வினாத்தாளில் அலகின் எடை × உங்கள் தவறு விகிதம்</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {weak.map((r) => (
            <li key={r.u.id}>
              {r.u.name_ta} <span className="text-sm text-stone-500">— {r.u.questions} வினாக்கள், {r.accuracy == null ? "இன்னும் பயிற்சி இல்லை" : `சரி ${r.accuracy}%`}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="h2 mb-2">அலகு வாரியாக</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="py-1 pr-2">அலகு</th>
              <th className="px-1">வினாத்தாளில்</th>
              <th className="px-1">நீங்கள்</th>
              {years.map((y) => <th key={y} className="px-1">{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ u, a, accuracy }) => (
              <tr key={u.id} className="border-t border-stone-100">
                <td className="py-1.5 pr-2">{u.name_ta}</td>
                <td className="px-1 text-center">{u.questions}{u.approx ? "*" : ""}</td>
                <td className={`px-1 text-center font-semibold ${accuracy == null ? "text-stone-400" : accuracy >= 70 ? "text-brand-600" : accuracy >= 40 ? "text-turmeric-500" : "text-kumkum-500"}`}>
                  {accuracy == null ? "—" : `${accuracy}%`}<span className="block text-[10px] font-normal text-stone-400">{a ? `${a.correct}/${a.attempted}` : ""}</span>
                </td>
                {years.map((y) => <td key={y} className="px-1 text-center">{pyqCount(u.id, y) || ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted mt-2">* தோராயமான எண்ணிக்கை. முந்தைய ஆண்டு வினாக்களை &quot;வினா வங்கி&quot; பகுதியில் சேர்த்தால் ஆண்டு வாரியான நெடுவரிசைகள் தோன்றும்.</p>
      </div>
    </div>
  );
}
