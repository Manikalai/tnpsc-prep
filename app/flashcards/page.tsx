import { requireUser } from "@/lib/supabase/server";
import { todayIST } from "@/lib/data";
import Flashcards from "@/components/Flashcards";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { sb, user } = await requireUser();
  const [{ data: due }, { count }] = await Promise.all([
    sb.from("flashcards").select("id,front,back,interval_days").eq("user_id", user.id).lte("due_date", todayIST()).order("due_date").limit(50),
    sb.from("flashcards").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return (
    <div className="space-y-4">
      <p className="muted">இன்று {due?.length ?? 0} அட்டைகள் · மொத்தம் {count ?? 0}. குறிப்புகளை உருவாக்கும்போது அட்டைகள் தானாகச் சேரும்.</p>
      <Flashcards cards={due ?? []} />
    </div>
  );
}
