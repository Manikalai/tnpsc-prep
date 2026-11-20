"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconHome, IconHomeFilled, IconClipboardCheck, IconClipboardCheckFilled, IconClock, IconClockFilled, IconNews, IconLayoutGrid, IconLayoutGridFilled, IconChevronLeft, type Icon } from "@tabler/icons-react";
import Emoji, { type EmojiName } from "@/components/Emoji";

const MAIN: { href: string; label: string; full: string; icon: Icon; on: Icon }[] = [
  { href: "/", label: "Home", full: "Home", icon: IconHome, on: IconHomeFilled },
  { href: "/quiz/new", label: "Quiz", full: "Quiz", icon: IconClipboardCheck, on: IconClipboardCheckFilled },
  { href: "/mock", label: "Mock", full: "Mock test", icon: IconClock, on: IconClockFilled },
  { href: "/ca", label: "Current", full: "Current affairs", icon: IconNews, on: IconNews },
  { href: "/more", label: "More", full: "More", icon: IconLayoutGrid, on: IconLayoutGridFilled },
];

export function Brand({ big = false }: { big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${big ? "text-3xl" : "text-lg"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-128.webp" alt="" width={big ? 56 : 34} height={big ? 56 : 34} className={`rounded-xl shadow-sm ring-1 ring-gold-400/60 ${big ? "h-14 w-14" : "h-[34px] w-[34px]"}`} />
      <span className="text-maroon-700">Saranya <span className="text-saffron-500">Prep</span></span>
    </span>
  );
}

const ROOTS = ["/", "/quiz/new", "/mock", "/ca", "/more"];
// short app-bar titles for sub-pages
const TITLES: [RegExp, string, EmojiName?][] = [
  [/^\/tamil\/kural/, "Thirukkural", "scroll"], [/^\/tamil\/nool/, "Books & authors", "writing"], [/^\/tamil/, "General Tamil"],
  [/^\/aptitude\/shortcuts/, "Shortcuts", "bulb"], [/^\/aptitude/, "Aptitude", "abacus"], [/^\/books/, "Textbooks", "books"], [/^\/chapter\//, "Lesson", "book"],
  [/^\/ca\//, "Current affairs", "news"], [/^\/papers/, "Previous papers", "memo"], [/^\/revision/, "Revision", "repeat"], [/^\/notes/, "Memory notes", "notebook"],
  [/^\/flashcards/, "Flashcards", "cards"], [/^\/analysis/, "Analysis", "chart"], [/^\/planner/, "Study plan", "calendar"], [/^\/ask/, "Ask the textbook", "bulb"],
  [/^\/mains/, "Mains", "writing"], [/^\/admin/, "Question bank", "clipboard"], [/^\/settings/, "Settings", "gear"], [/^\/syllabus/, "Syllabus", "bookmark"],
  [/^\/offline/, "Offline", "offline"], [/^\/timeline/, "Years & events", "hourglass"], [/^\/test\/.*\/result/, "Results", "trophy"],
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const isRoot = ROOTS.includes(path);
  const hit = TITLES.find(([rx]) => rx.test(path));
  const title = hit?.[1], titleEmoji = hit?.[2];
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(path.split("/").slice(0, -1).join("/") || "/");
  };
  if (path === "/login" || (path.startsWith("/test/") && !path.endsWith("/result"))) return null;
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <header className="app-header sticky top-0 z-20 border-b border-stone-200/70 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-maroon-500 via-saffron-500 to-gold-400" />
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-3">
          {isRoot ? (
            <Link href="/" aria-label="Home" className="px-1"><Brand /></Link>
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <button onClick={back} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-maroon-700 active:bg-stone-200/70">
                <IconChevronLeft size={26} stroke={2.4} />
              </button>
              {titleEmoji ? <Emoji name={titleEmoji} size={24} /> : title === "General Tamil" ? <span className="text-lg font-bold text-maroon-700">அ</span> : null}
              <span className="truncate text-[17px] font-bold text-maroon-700">{title ?? "Saranya Prep"}</span>
            </div>
          )}
          <nav className="hidden gap-1 md:flex">
            {MAIN.map((m) => (
              <Link key={m.href} href={m.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active(m.href) ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"}`}>
                {m.full}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-white/90 shadow-[0_-6px_20px_rgba(60,40,10,0.06)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {MAIN.map((m) => {
            const on = active(m.href);
            return (
              <Link key={m.href} href={m.href} prefetch={true} className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11.5px] ${on ? "font-bold text-maroon-700" : "font-medium text-stone-500"}`}>
                {on && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-maroon-500 via-saffron-500 to-gold-400" />}
                <span key={on ? path : "off"} className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${on ? "animate-[navpop_.35s_ease] bg-gradient-to-br from-saffron-100 to-amber-50" : ""}`}>
                  {(() => { const I = on ? m.on : m.icon; return <I size={23} stroke={on ? 2.2 : 1.7} />; })()}
                </span>
                <span className="leading-none">{m.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
