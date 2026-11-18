import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { todayIST } from "@/lib/data";
import { taDate } from "@/lib/format";
import StartButton from "@/components/StartButton";
import CaAddForm from "@/components/CaAddForm";

export const dynamic = "force-dynamic";

export default async function CaIndex({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const { sb } = await requireUser();
  const month = sp.month ?? todayIST().slice(0, 7);
  const start = `${month}-01`;
  const next = new Date(start + "T00:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = next.toISOString().slice(0, 10);
  const { data } = await sb.from("current_affairs").select("ca_date,region").gte("ca_date", start).lt("ca_date", end).order("ca_date", { ascending: false });
  const days = new Map<string, { tn: number; india: number }>();
  for (const r of data ?? []) {
    const d = days.get(r.ca_date) ?? { tn: 0, india: 0 };
    d[r.region as "tn" | "india"]++;
    days.set(r.ca_date, d);
  }
  const { data: lastRun } = await sb.from("job_runs").select("ran_at,ok,detail").eq("job", "daily_ca").order("ran_at", { ascending: false }).limit(1);
  const prev = new Date(start + "T00:00:00Z");
  prev.setUTCMonth(prev.getUTCMonth() - 1);

  return (
    <div className="space-y-4">
      <h1 className="h1">நடப்பு நிகழ்வுகள்</h1>
      <p className="muted">தமிழ்நாடு, இந்தியா — தினமும் காலை 6 மணிக்குத் தானாகத் தயாராகும்.</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/ca/${todayIST()}`} className="btn">இன்றைய குறிப்புகள்</Link>
        <StartButton url="/api/ca/run" label="இப்போதே புதுப்பி" className="btn-ghost" busyLabel="செய்திகளைச் சேகரிக்கிறது… (1 நிமிடம் வரை)" />
        <StartButton url="/api/ca/quiz" body={{ from: start, to: end }} label="இந்த மாதத் தொகுப்பு வினாக்கள்" className="btn-ghost" />
        <Link href={`/ca/month?m=${month}`} className="btn-ghost">மாதத் தொகுப்பு (அச்சிட)</Link>
      </div>
      {lastRun?.[0] && (
        <p className="muted">கடைசியாகப் புதுப்பித்தது: {taDate(lastRun[0].ran_at)} {lastRun[0].ok ? "✓" : `✗ ${lastRun[0].detail?.error ?? ""}`}</p>
      )}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <Link href={`/ca?month=${prev.toISOString().slice(0, 7)}`} className="text-sm underline">← முந்தைய மாதம்</Link>
          <span className="font-semibold">{taDate(start).replace(/^\d+\s/, "")}</span>
          <Link href={`/ca?month=${end.slice(0, 7)}`} className="text-sm underline">அடுத்த மாதம் →</Link>
        </div>
        {days.size === 0 && <p className="muted">இந்த மாதத்துக்குக் குறிப்புகள் இல்லை.</p>}
        <ul className="divide-y divide-stone-100">
          {[...days.entries()].map(([d, c]) => (
            <li key={d}>
              <Link href={`/ca/${d}`} className="flex justify-between py-2 hover:text-brand-600">
                <span>{taDate(d, true)}</span>
                <span className="text-sm text-stone-500">தமிழ்நாடு {c.tn} · இந்தியா {c.india}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <CaAddForm />
    </div>
  );
}
