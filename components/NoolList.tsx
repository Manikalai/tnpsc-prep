"use client";
import { useState } from "react";
import type { NoolEntry } from "@/lib/tamil";

// searchable list; tap "Hide authors" to test yourself
export default function NoolList({ rows }: { rows: (NoolEntry & { std: number; lesson: string })[] }) {
  const [q, setQ] = useState("");
  const [hide, setHide] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const list = rows.filter((r) => !q || `${r.nool} ${r.asiriyar} ${r.about}`.includes(q));
  return (
    <>
      <div className="flex gap-2">
        <input className="input" placeholder="தேடு: நூல் அல்லது ஆசிரியர்" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`btn-ghost btn-sm shrink-0 ${hide ? "!bg-maroon-600 !text-white" : ""}`} onClick={() => { setHide(!hide); setOpen(new Set()); }}>{hide ? "Show" : "Hide"} authors</button>
      </div>
      <div className="card divide-y divide-stone-100 !p-0">
        {list.map((r, i) => {
          const shown = !hide || open.has(i);
          return (
            <button key={i} onClick={() => setOpen(new Set(open).add(i))} className="block w-full px-4 py-3 text-left active:bg-stone-50">
              <p className="font-bold text-maroon-700">{r.nool}</p>
              <p className={`text-[15px] ${shown ? "" : "select-none rounded bg-stone-200 text-transparent"}`}>✍️ {r.asiriyar}</p>
              {shown && r.about && <p className="text-[13px] text-stone-500">{r.about}</p>}
              <p className="text-[11.5px] text-stone-400">{r.lesson}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}
