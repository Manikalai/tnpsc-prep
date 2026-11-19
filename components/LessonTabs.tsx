"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";

/** Lesson tabs switch on the phone itself: no server round trip per tap.
 *  A panel is mounted the first time it is opened and kept afterwards. */
export default function LessonTabs({ tabs, panels, initial, prev, next }: {
  tabs: readonly (readonly [string, string])[];
  panels: Record<string, ReactNode>;
  initial: string;
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  const [tab, setTab] = useState(initial);
  const [seen, setSeen] = useState<Set<string>>(() => new Set([initial]));
  const open = (k: string) => {
    setTab(k);
    setSeen((s) => (s.has(k) ? s : new Set(s).add(k)));
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", k);
      window.history.replaceState(window.history.state, "", u);
    } catch {}
  };
  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => open(k)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tab === k ? "bg-brand-500 text-white" : "bg-white ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>
      {tabs.map(([k]) => seen.has(k) && (
        <div key={k} hidden={tab !== k} className="space-y-4">{panels[k]}</div>
      ))}
      <div className="flex justify-between gap-2 pt-1">
        {prev ? <Link className="pill-nav" href={`${prev.href}?tab=${tab}`}>{prev.label}</Link> : <span />}
        {next ? <Link className="pill-nav" href={`${next.href}?tab=${tab}`}>{next.label}</Link> : <span />}
      </div>
    </>
  );
}
