import { requireUser } from "@/lib/supabase/server";
import { todayIST } from "@/lib/data";
import { taDate } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function CaMonth({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const { sb } = await requireUser();
  const month = m ?? todayIST().slice(0, 7);
  const start = `${month}-01`;
  const next = new Date(start + "T00:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1);
  const { data } = await sb.from("current_affairs").select("*").gte("ca_date", start).lt("ca_date", next.toISOString().slice(0, 10)).order("ca_date");
  const items = data ?? [];
  const cats = [...new Set(items.map((i) => i.category))].sort();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="h1">மாதத் தொகுப்பு</h1>
        <PrintButton />
      </div>
      <h2 className="text-xl font-bold">நடப்பு நிகழ்வுகள் – {taDate(start).replace(/^\d+\s/, "")}</h2>
      <p className="muted">தலைப்பு வாரியாக · {items.length} குறிப்புகள்</p>
      {cats.map((c) => (
        <section key={c}>
          <h3 className="mb-2 mt-4 border-b border-stone-300 pb-1 text-lg font-bold text-brand-700">{c}</h3>
          <ul className="space-y-2">
            {items.filter((i) => i.category === c).map((i) => (
              <li key={i.id} className="break-inside-avoid">
                <b>{i.region === "tn" ? "[தமிழ்நாடு] " : ""}{i.title_ta}</b> <span className="text-xs text-stone-500">({i.ca_date})</span>
                <p className="text-sm">{i.note_ta}</p>
                {i.exam_point_ta && <p className="text-sm text-brand-700">➤ {i.exam_point_ta}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
