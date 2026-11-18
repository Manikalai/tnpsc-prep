"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/", label: "முகப்பு", icon: "⌂" },
  { href: "/syllabus", label: "பாடத்திட்டம்", icon: "☰" },
  { href: "/mock", label: "மாதிரித் தேர்வு", icon: "✎" },
  { href: "/ca", label: "நடப்பு நிகழ்வுகள்", icon: "◉" },
  { href: "/more", label: "மேலும்", icon: "⋯" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login" || path.startsWith("/test/") && !path.endsWith("/result")) return null;
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand-700">
            TNPSC <span className="text-turmeric-500">தயாரிப்பு</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {MAIN.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active(m.href) ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {m.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {MAIN.map((m) => (
            <Link key={m.href} href={m.href} className={`flex flex-col items-center py-2 text-[11px] ${active(m.href) ? "text-brand-600" : "text-stone-500"}`}>
              <span className="text-lg leading-none">{m.icon}</span>
              <span className="mt-1 leading-tight">{m.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
