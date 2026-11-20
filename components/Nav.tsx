"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Vel } from "@/components/Murugan";

const I = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  quiz: "M9 4h6M9 4a2 2 0 0 0-2 2H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1a2 2 0 0 0-2-2M9 12l2 2 4-4M9 17h6",
  mock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  ca: "M4 5h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM18 9h2v9a2 2 0 0 1-2 2M8 9h6M8 13h6M8 17h3",
  more: "M4 6h16M4 12h16M4 18h16",
};
const MAIN = [
  { href: "/", label: "Home", full: "Home", icon: I.home },
  { href: "/quiz/new", label: "Quiz", full: "Quiz", icon: I.quiz },
  { href: "/mock", label: "Mock", full: "Mock test", icon: I.mock },
  { href: "/ca", label: "Current", full: "Current affairs", icon: I.ca },
  { href: "/more", label: "More", full: "More", icon: I.more },
];

export function Brand({ big = false }: { big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${big ? "text-3xl" : "text-lg"}`}>
      <span className={`grid place-items-center rounded-xl bg-gradient-to-br from-maroon-500 to-saffron-500 shadow-sm ${big ? "h-14 w-14" : "h-8 w-8"}`}>
        <Vel className={big ? "h-11" : "h-6"} gold="#ffd76a" dark="#8a5a00" />
      </span>
      <span className="text-maroon-700">Saranya <span className="text-saffron-500">Prep</span></span>
    </span>
  );
}

const ROOTS = ["/", "/quiz/new", "/mock", "/ca", "/more"];
// short app-bar titles for sub-pages
const TITLES: [RegExp, string][] = [
  [/^\/aptitude\/shortcuts/, "Shortcuts"], [/^\/aptitude/, "Aptitude"], [/^\/books/, "Textbooks"], [/^\/chapter\//, "Lesson"],
  [/^\/ca\//, "Current affairs"], [/^\/papers/, "Previous papers"], [/^\/revision/, "Revision"], [/^\/notes/, "Memory notes"],
  [/^\/flashcards/, "Flashcards"], [/^\/analysis/, "Analysis"], [/^\/planner/, "Study plan"], [/^\/ask/, "Ask the textbook"],
  [/^\/mains/, "Mains"], [/^\/admin/, "Question bank"], [/^\/settings/, "Settings"], [/^\/syllabus/, "Syllabus"],
  [/^\/offline/, "Offline"], [/^\/timeline/, "Years & events"], [/^\/test\/.*\/result/, "Results"],
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const isRoot = ROOTS.includes(path);
  const title = TITLES.find(([rx]) => rx.test(path))?.[1];
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(path.split("/").slice(0, -1).join("/") || "/");
  };
  if (path === "/login" || (path.startsWith("/test/") && !path.endsWith("/result"))) return null;
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-maroon-500 via-saffron-500 to-gold-400" />
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-3">
          {isRoot ? (
            <Link href="/" aria-label="Home" className="px-1"><Brand /></Link>
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <button onClick={back} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-maroon-700 active:bg-stone-200/70">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
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
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {MAIN.map((m) => {
            const on = active(m.href);
            return (
              <Link key={m.href} href={m.href} prefetch={true} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-medium ${on ? "text-brand-700" : "text-stone-500"}`}>
                <span className={`grid h-7 w-12 place-items-center rounded-full transition ${on ? "bg-brand-100" : ""}`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
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
