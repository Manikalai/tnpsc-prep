import Link from "next/link";
import { APT_TYPES } from "@/lib/aptitude";
import { requireUser } from "@/lib/supabase/server";
import AptitudeDrill from "@/components/AptitudeDrill";

export const dynamic = "force-dynamic";

export default async function Aptitude() {
  const { sb, user } = await requireUser();
  const { data: past } = await sb.from("tests").select("title,score,max_score,submitted_at").eq("user_id", user.id).eq("kind", "aptitude").order("submitted_at", { ascending: false }).limit(5);
  return (
    <div className="space-y-4">
      <h1 className="h1">திறனறிவும் மனக்கணக்கு நுண்ணறிவும்</h1>
      <p className="muted">ஒவ்வொரு வகைக்கும் வழிமுறை, சுருக்கு வழிகள், பயிற்சி. வினாக்கள் கணினியால் கணக்கிடப்படுவதால் விடைகள் எப்போதும் சரியானவை. தேர்வில் 25 வினாக்களுக்கு சுமார் 25–30 நிமிடம் ஒதுக்குங்கள்.</p>
      <AptitudeDrill keys={APT_TYPES.map((t) => t.key)} n={25} title="கலப்புப் பயிற்சி – 25 வினாக்கள்" seconds={25 * 60} />
      <div className="grid gap-2 sm:grid-cols-2">
        {APT_TYPES.map((t) => (
          <Link key={t.key} href={`/aptitude/${t.key}`} className="card hover:border-brand-500">
            <p className="font-semibold">{t.name}</p>
            <p className="muted">{t.unit === "aptitude" ? "திறனறிவு" : "காரணவியல்"} · வழிமுறை + 10 வினாக்கள்</p>
          </Link>
        ))}
      </div>
      {!!past?.length && (
        <div className="card">
          <h2 className="h2 mb-2">சமீபத்திய பயிற்சிகள்</h2>
          {past.map((p, k) => (
            <p key={k} className="flex justify-between text-sm"><span>{p.title}</span><b>{Number(p.score)}/{Number(p.max_score)}</b></p>
          ))}
        </div>
      )}
    </div>
  );
}
