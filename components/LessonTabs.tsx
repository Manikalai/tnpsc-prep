"use client";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import ReportButton from "@/components/ReportButton";
import { useRef, useState, type ReactNode, type TouchEvent } from "react";

/** Lesson tabs switch on the phone itself: no server round trip per tap.
 *  A panel is mounted the first time it is opened and kept afterwards. */
export default function LessonTabs({ tabs, panels, initial, prev, next, chapterId }: {
  chapterId?: number;
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
  // swipe left / right on the content to move between tabs (ignored inside things that scroll sideways)
  const start = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const onStart = (e: TouchEvent) => {
    let el = e.target as HTMLElement | null, ok = true;
    for (; el && el !== e.currentTarget; el = el.parentElement)
      if (el.dataset.noswipe !== undefined || el.scrollWidth > el.clientWidth + 4) { ok = false; break; }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, ok: ok && e.touches.length === 1 };
  };
  const onEnd = (e: TouchEvent) => {
    const s0 = start.current; start.current = null;
    if (!s0?.ok) return;
    const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const i = tabs.findIndex(([k]) => k === tab), j = dx < 0 ? i + 1 : i - 1;
    if (j >= 0 && j < tabs.length) { openAndShow(tabs[j][0]); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  const bar = useRef<HTMLDivElement>(null);
  const openAndShow = (k: string) => {
    open(k);
    requestAnimationFrame(() => bar.current?.querySelector<HTMLElement>(`[data-k="${k}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
  };
  return (
    <>
      <div ref={bar} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(([k, l]) => (
          <button key={k} data-k={k} type="button" onClick={() => openAndShow(k)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${tab === k ? "bg-gradient-to-r from-maroon-600 to-saffron-500 text-white shadow-md shadow-saffron-500/25" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>{l}</button>
        ))}
      </div>
      <div onTouchStart={onStart} onTouchEnd={onEnd} className="min-h-[50vh]">
        {tabs.map(([k]) => seen.has(k) && (
          <div key={k} hidden={tab !== k} className={`space-y-4 ${tab === k ? "animate-[fadein_.22s_ease]" : ""}`}>
            {panels[k]}
            {chapterId && k !== "text" && k !== "mcq" && <div className="flex justify-end"><ReportButton chapterId={chapterId} kind={k} /></div>}
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 pt-1">
        {prev ? <Link className="pill-nav" href={`${prev.href}?tab=${tab}`}><IconChevronLeft size={18} stroke={2.4} />{prev.label.replace("‹ ", "")}</Link> : <span />}
        {next ? <Link className="pill-nav" href={`${next.href}?tab=${tab}`}>{next.label.replace(" ›", "")}<IconChevronRight size={18} stroke={2.4} /></Link> : <span />}
      </div>
    </>
  );
}
