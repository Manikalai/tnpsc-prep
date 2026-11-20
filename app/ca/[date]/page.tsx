import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { taDate } from "@/lib/format";
import StartButton from "@/components/StartButton";
import DateJump from "@/components/DateJump";
import { todayIST } from "@/lib/data";

export const dynamic = "force-dynamic";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import CaList, { type CA } from "@/components/CaList";
import ListenButton from "@/components/ListenButton";

export default async function CaDay({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const { sb } = await requireUser();
  const [{ data }, { count }] = await Promise.all([
    sb.from("current_affairs").select("*").eq("ca_date", date).order("region", { ascending: false }).order("category"),
    sb.from("questions").select("*", { count: "exact", head: true }).eq("origin", "ca").eq("status", "active").eq("ca_date", date),
  ]);
  const prev = new Date(date + "T00:00:00Z"); prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/ca/${prev.toISOString().slice(0, 10)}`} className="pill-nav h-10 w-10 justify-center px-0" aria-label="Previous day"><IconChevronLeft size={22} stroke={2.4} /></Link>
        <h1 className="text-center text-[17px] font-bold leading-tight text-brand-700">{taDate(date, true)}</h1>
        <Link href={`/ca/${next.toISOString().slice(0, 10)}`} className="pill-nav h-10 w-10 justify-center px-0" aria-label="Next day"><IconChevronRight size={22} stroke={2.4} /></Link>
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <DateJump value={date} max={todayIST()} />
        {(count ?? 0) > 0 ? (
          <StartButton url="/api/ca/quiz" body={{ date }} label={`📝 ${count} questions for this day`} />
        ) : (
          <span className="text-sm text-stone-500">இந்த நாளுக்கு வினாக்கள் இல்லை</span>
        )}
      </div>
      {!data?.length ? (
        <div className="card">
          <p>இந்த நாளுக்குக் குறிப்புகள் இல்லை.</p>
          <div className="mt-3"><StartButton url="/api/ca/run" label="Prepare now" busyLabel="Collecting news…" /></div>
        </div>
      ) : (
        <>
          <ListenButton target="ln-ca" />
          <div id="ln-ca" className="space-y-4"><CaList items={data as CA[]} /></div>
        </>
      )}
    </div>
  );
}
