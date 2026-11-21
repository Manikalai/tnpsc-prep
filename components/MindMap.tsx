"use client";
// Lesson mind map, made for a phone screen: topic at the top, coloured main branches below it;
// tap a branch to open / close it, "Open all" for a quick full revision. Pure HTML/CSS (no libraries).
import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { MindMap as MM, MindNode } from "@/lib/chapters";

const COLORS = [
  { bar: "bg-rose-500", soft: "bg-rose-50", ring: "ring-rose-200", text: "text-rose-700", line: "border-rose-300" },
  { bar: "bg-amber-500", soft: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-800", line: "border-amber-300" },
  { bar: "bg-emerald-500", soft: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-700", line: "border-emerald-300" },
  { bar: "bg-sky-500", soft: "bg-sky-50", ring: "ring-sky-200", text: "text-sky-700", line: "border-sky-300" },
  { bar: "bg-violet-500", soft: "bg-violet-50", ring: "ring-violet-200", text: "text-violet-700", line: "border-violet-300" },
  { bar: "bg-orange-500", soft: "bg-orange-50", ring: "ring-orange-200", text: "text-orange-800", line: "border-orange-300" },
  { bar: "bg-teal-500", soft: "bg-teal-50", ring: "ring-teal-200", text: "text-teal-700", line: "border-teal-300" },
];

function Leaves({ nodes, c }: { nodes: MindNode[]; c: (typeof COLORS)[number] }) {
  return (
    <ul className={`ml-3 space-y-1.5 border-l-2 ${c.line} pl-3`}>
      {nodes.map((n, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-3 top-3 h-0.5 w-3 ${c.bar} opacity-40`} />
          <span className={`inline-block rounded-xl ${c.soft} px-2.5 py-1 text-[14.5px] leading-snug ring-1 ${c.ring}`}>{n.t}</span>
          {!!n.c?.length && (
            <ul className="mt-1 ml-3 flex flex-wrap gap-1.5">
              {n.c.map((g, k) => <li key={k} className="rounded-lg bg-white px-2 py-0.5 text-[13px] text-stone-700 ring-1 ring-stone-200">{g.t}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function MindMap({ m }: { m: MM }) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const all = open.size === m.branches.length;
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500">{m.branches.length} கிளைகள் · தட்டினால் திறக்கும்</span>
        <button onClick={() => setOpen(all ? new Set() : new Set(m.branches.map((_, i) => i)))} className="chip !py-1">{all ? "Close all" : "Open all"}</button>
      </div>
      <div id="ln-mindmap" className="relative">
        {/* root */}
        <div className="mx-auto w-fit max-w-full rounded-2xl bg-gradient-to-br from-maroon-700 to-saffron-500 px-5 py-3 text-center text-lg font-bold text-white shadow-lg">{m.root}</div>
        <div className="mx-auto h-4 w-0.5 bg-stone-300" />
        <div className="space-y-2.5 border-t-2 border-stone-200 pt-3">
          {m.branches.map((b, i) => {
            const c = COLORS[i % COLORS.length], on = open.has(i);
            return (
              <div key={i} className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-stone-200">
                <button onClick={() => toggle(i)} className="flex w-full items-center gap-2 text-left">
                  <span className={`h-7 w-1.5 shrink-0 rounded-full ${c.bar}`} />
                  <span className={`flex-1 text-[16px] font-bold ${c.text}`}>{b.t}</span>
                  <span className="text-xs text-stone-400">{b.c?.length ?? 0}</span>
                  <IconChevronDown size={18} className={`text-stone-400 transition-transform ${on ? "rotate-180" : ""}`} />
                </button>
                {on && !!b.c?.length && <div className="mt-2 animate-[fadein_.2s_ease]"><Leaves nodes={b.c} c={c} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** flat text for Listen / flashcards */
export function mindMapCards(m: MM) {
  return m.branches.map((b) => ({ front: `${m.root} → ${b.t}`, back: (b.c ?? []).map((n) => `• ${n.t}${n.c?.length ? ` (${n.c.map((g) => g.t).join(", ")})` : ""}`).join("\n") }));
}
