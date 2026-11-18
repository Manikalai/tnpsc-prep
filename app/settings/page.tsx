import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import SettingsForm from "@/components/SettingsForm";

export default async function Settings() {
  const { sb, user } = await requireUser();
  const p = await getProfile(sb, user.id);
  return (
    <div className="space-y-4">
      <h1 className="h1">அமைப்புகள்</h1>
      <p className="muted">{user.email}</p>
      <SettingsForm name={p.display_name ?? ""} exam={p.target_exam} date={p.exam_date ?? ""} />
    </div>
  );
}
