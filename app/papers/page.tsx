import { requireUser } from "@/lib/supabase/server";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";
const LABEL: Record<string, string> = { G4: "தொகுதி IV", G2: "தொகுதி II / IIA", G1: "தொகுதி I" };

export default async function Papers() {
  const { sb, user } = await requireUser();
  const { data } = await sb.from("questions").select("exam_code,pyq_year,status").eq("origin", "pyq").limit(20000);
  const groups = new Map<string, { exam: string; year: number; active: number; flagged: number }>();
  for (const q of data ?? []) {
    if (!q.exam_code || !q.pyq_year) continue;
    const k = `${q.exam_code}|${q.pyq_year}`;
    const g = groups.get(k) ?? { exam: q.exam_code, year: q.pyq_year, active: 0, flagged: 0 };
    if (q.status === "active") g.active++;
    else if (q.status === "flagged") g.flagged++;
    groups.set(k, g);
  }
  const { data: past } = await sb.from("tests").select("title,score,max_score,submitted_at").eq("user_id", user.id).like("title", "%உண்மை வினாத்தாள்%").not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(20);
  const list = [...groups.values()].sort((a, b) => a.exam.localeCompare(b.exam) || b.year - a.year);
  return (
    <div className="space-y-4">
      <p className="muted">உண்மையான முந்தைய ஆண்டு வினாத்தாள், அதே வரிசையில், தேர்வு நேரத்துடன் (3 மணி). மதிப்பீடு TNPSC-யின் அதிகாரபூர்வ விடைக்குறிப்பின்படி.</p>
      {!list.length && <p className="card">இன்னும் வினாத்தாள்கள் சேர்க்கப்படவில்லை.</p>}
      {list.map((g) => (
        <div key={`${g.exam}${g.year}`} className="card flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{LABEL[g.exam] ?? g.exam} · {g.year}</p>
            <p className="muted">{g.active} வினாக்கள்{g.flagged ? ` · ${g.flagged} சரிபார்ப்பில் (வினா வங்கி)` : ""}</p>
          </div>
          <StartButton url="/api/paper" body={{ exam: g.exam, year: g.year }} label="Write" confirm={`${LABEL[g.exam]} ${g.year} வினாத்தாள் – 3 மணி நேரம். தொடங்கலாமா?`} />
        </div>
      ))}
      {!!past?.length && (
        <div className="card">
          <h2 className="h2 mb-2">உங்கள் முயற்சிகள்</h2>
          {past.map((p, k) => <p key={k} className="flex justify-between text-sm"><span>{p.title}</span><b>{Number(p.score)}/{Number(p.max_score)}</b></p>)}
        </div>
      )}
    </div>
  );
}
