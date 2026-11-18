import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { loadExam } from "@/lib/exam";
import Md from "@/components/Md";
import StartButton from "@/components/StartButton";
import UnitPicker from "@/components/UnitPicker";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { mnemonic: "நினைவூட்டி", summary: "ஒருபக்கச் சுருக்கம்", table: "அட்டவணை", timeline: "காலவரிசை", facts: "குறிப்புகள்" };

export default async function Notes({ searchParams }: { searchParams: Promise<{ unit?: string; topic?: string }> }) {
  const sp = await searchParams;
  const { sb, user } = await requireUser();
  const profile = await getProfile(sb, user.id);
  const examCode = sp.unit?.split("-")[0] ?? profile.target_exam;
  const { units } = await loadExam(sb, examCode);
  const unit = units.find((u) => u.id === sp.unit) ?? units.find((u) => u.subject !== "aptitude" && u.subject !== "reasoning");
  const { data: topics } = unit ? await sb.from("topics").select("id,name_ta").eq("unit_id", unit.id).order("sort") : { data: [] };
  let q = sb.from("notes").select("*").eq("unit_id", unit?.id ?? "").order("pinned", { ascending: false }).order("created_at", { ascending: false });
  if (sp.topic) q = q.eq("topic_id", sp.topic);
  const { data: notes } = await q;

  return (
    <div className="space-y-4">
      <h1 className="h1">நினைவுக் குறிப்புகள்</h1>
      <p className="muted">அலகு அல்லது தலைப்பைத் தேர்ந்தெடுத்து, பாடநூலிலிருந்து நினைவூட்டி, சுருக்கம், அட்டவணை, 10 நினைவு அட்டைகளை உருவாக்குங்கள். நல்லவற்றை ★ செய்து வைத்துக்கொள்ளுங்கள்.</p>
      <UnitPicker units={units.filter((u) => u.subject !== "aptitude" && u.subject !== "reasoning").map((u) => ({ id: u.id, name: u.name_ta }))} unitId={unit?.id} topics={topics ?? []} topicId={sp.topic} />
      {unit && (
        <StartButton
          url="/api/notes"
          body={{ action: "generate", unitId: unit.id, topicId: sp.topic }}
          label="புதிய குறிப்புகளை உருவாக்கு"
          busyLabel="பாடநூலிலிருந்து குறிப்புகள் எழுதுகிறது… (30 வினாடி)"
        />
      )}
      {!notes?.length && <p className="muted">இந்த அலகுக்கு இன்னும் குறிப்புகள் இல்லை.</p>}
      {(notes ?? []).map((n) => (
        <article key={n.id} className="card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="chip">{KIND[n.kind] ?? n.kind}</span>
              <h2 className="mt-1 font-bold">{n.title}</h2>
            </div>
            {n.user_id === user.id && (
              <div className="flex shrink-0 gap-1">
                <StartButton url="/api/notes" body={{ action: "pin", id: n.id, pinned: !n.pinned }} label={n.pinned ? "★" : "☆"} className="btn-ghost btn-sm" busyLabel="…" />
                <StartButton url="/api/notes" body={{ action: "delete", id: n.id }} label="நீக்கு" className="btn-ghost btn-sm" busyLabel="…" confirm="இந்தக் குறிப்பை நீக்கவா?" />
              </div>
            )}
          </div>
          <Md text={n.content} className="mt-2" />
          {n.source_ref && <p className="mt-2 text-xs text-stone-500">ஆதாரம்: {n.source_ref}</p>}
        </article>
      ))}
    </div>
  );
}
