import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import VoicePicker from "@/components/VoicePicker";
import Emoji from "@/components/Emoji";
import SettingsForm from "@/components/SettingsForm";

export default async function Settings() {
  const { sb, user } = await requireUser();
  const p = await getProfile(sb, user.id);
  return (
    <div className="space-y-4">
      <p className="muted">{user.email}</p>
      <SettingsForm name={p.display_name ?? ""} exam={p.target_exam} date={p.exam_date ?? ""} />
      <section className="card">
        <h2 className="h2 flex items-center gap-2"><Emoji name="bell" size={26} />Listen voice</h2>
        <p className="muted mb-1">🔊 Listen-க்கான குரல் · ▶ அழுத்திக் கேட்டுப் பாருங்கள்</p>
        <VoicePicker />
      </section>
    </div>
  );
}
