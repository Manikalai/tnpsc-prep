import { requireUser } from "@/lib/supabase/server";
import { todayIST } from "@/lib/data";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";

export default async function Revision() {
  const { sb, user } = await requireUser();
  const today = todayIST();
  const [{ count: due }, { count: total }, { data: upcoming }] = await Promise.all([
    sb.from("review_queue").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("due_date", today),
    sb.from("review_queue").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("review_queue").select("due_date").eq("user_id", user.id).gt("due_date", today).order("due_date").limit(500),
  ]);
  const byDay = new Map<string, number>();
  for (const r of upcoming ?? []) byDay.set(r.due_date, (byDay.get(r.due_date) ?? 0) + 1);
  return (
    <div className="space-y-4">
      <h1 className="h1">திருப்புதல்</h1>
      <div className="card">
        <p className="text-4xl font-bold text-kumkum-500">{due ?? 0}</p>
        <p>இன்று மீண்டும் செய்ய வேண்டிய வினாக்கள் (மொத்தப் பட்டியலில் {total ?? 0})</p>
        <p className="muted mt-1">தவறிய வினா நாளை வரும்; சரியாகச் சொன்னால் 3, 7, 15, 30, 60 நாட்கள் இடைவெளியில் மீண்டும் வரும். 6 முறை தொடர்ந்து சரியானால் பட்டியலிலிருந்து நீங்கும்.</p>
        <div className="mt-3"><StartButton url="/api/revision" label="திருப்புதலைத் தொடங்கு" /></div>
      </div>
      {byDay.size > 0 && (
        <div className="card">
          <h2 className="h2 mb-2">வரும் நாட்கள்</h2>
          <ul className="text-sm">
            {[...byDay.entries()].slice(0, 10).map(([d, n]) => (
              <li key={d} className="flex justify-between py-1"><span>{d}</span><span>{n}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
