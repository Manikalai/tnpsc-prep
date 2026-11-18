import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { taDate } from "@/lib/format";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";

import CaList, { type CA } from "@/components/CaList";

export default async function CaDay({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const { sb } = await requireUser();
  const [{ data }, { count }] = await Promise.all([
    sb.from("current_affairs").select("*").eq("ca_date", date).order("region", { ascending: false }).order("category"),
    sb.from("questions").select("*", { count: "exact", head: true }).eq("origin", "ca").eq("ca_date", date),
  ]);
  const prev = new Date(date + "T00:00:00Z"); prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/ca/${prev.toISOString().slice(0, 10)}`} className="underline">← முந்தைய நாள்</Link>
        <Link href="/ca" className="underline">எல்லா நாட்களும்</Link>
        <Link href={`/ca/${next.toISOString().slice(0, 10)}`} className="underline">அடுத்த நாள் →</Link>
      </div>
      <h1 className="h1">நடப்பு நிகழ்வுகள் · {taDate(date, true)}</h1>
      {!data?.length ? (
        <div className="card">
          <p>இந்த நாளுக்குக் குறிப்புகள் இல்லை.</p>
          <div className="mt-3"><StartButton url="/api/ca/run" label="இப்போதே தயாரி" busyLabel="செய்திகளைச் சேகரிக்கிறது…" /></div>
        </div>
      ) : (
        <>
          <CaList items={data as CA[]} />
          {(count ?? 0) > 0 && (
            <div className="card text-center">
              <p className="mb-2">இன்றைய {count} வினாக்கள்</p>
              <StartButton url="/api/ca/quiz" body={{ date }} label="வினாடி வினா தொடங்கு" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
