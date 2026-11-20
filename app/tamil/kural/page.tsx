import KuralApp from "@/components/KuralApp";
import { requireUser } from "@/lib/supabase/server";

export default async function KuralPage() {
  await requireUser();
  return (
    <div className="space-y-3">
      <h1 className="h1">திருக்குறள்</h1>
      <p className="muted">1330 குறள்கள் · 133 அதிகாரங்கள். வினாக்கள் குறள் உரையிலிருந்து நேரடியாக — விடைகள் துல்லியமானவை.</p>
      <KuralApp />
    </div>
  );
}
