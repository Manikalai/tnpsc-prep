import Link from "next/link";
import InstallApp from "@/components/InstallApp";
import Emoji, { type EmojiName } from "@/components/Emoji";

const TINT: Record<string, string> = {"books": "from-sky-100 to-sky-50", "bookmark": "from-amber-100 to-amber-50", "hourglass": "from-orange-100 to-amber-50", "notebook": "from-lime-100 to-lime-50", "abacus": "from-emerald-100 to-emerald-50", "bulb": "from-violet-100 to-violet-50", "memo": "from-yellow-100 to-yellow-50", "repeat": "from-orange-100 to-orange-50", "cards": "from-rose-100 to-rose-50", "writing": "from-stone-200 to-stone-50", "calendar": "from-sky-100 to-blue-50", "chart": "from-indigo-100 to-indigo-50", "offline": "from-amber-100 to-orange-50", "clipboard": "from-teal-100 to-teal-50", "gear": "from-slate-200 to-slate-50"};

const GROUPS: { title: string; items: [string, string, string, string][] }[] = [
  {
    title: "Study",
    items: [
      ["/books", "books", "Textbooks", "Class → Term → Lesson"],
      ["/syllabus", "bookmark", "Syllabus", "Progress by unit"],
      ["/timeline", "hourglass", "Years & events", "Timeline across subjects, memory tricks"],
      ["/notes", "notebook", "Memory notes", "Mnemonics, summaries, tables"],
      ["/tamil", "அ", "General Tamil", "100 of 200 questions: grammar, Thirukkural, books & authors"],
      ["/aptitude", "abacus", "Aptitude", "10 topics, shortcuts"],
      ["/ask", "bulb", "Ask the textbook", "Doubts answered from the textbook"],
    ],
  },
  {
    title: "Practice",
    items: [
      ["/papers", "memo", "TNPSC previous papers", "Past years, timed"],
      ["/revision", "repeat", "Revision", "Missed questions after 1, 3, 7, 15 days"],
      ["/flashcards", "cards", "Flashcards", "Quick revision"],
      ["/mains", "writing", "Mains", "Group 1 answer writing"],
    ],
  },
  {
    title: "Plan & progress",
    items: [
      ["/planner", "calendar", "Study plan", "Targets up to the exam date"],
      ["/analysis", "chart", "Analysis", "Weak units"],
    ],
  },
  {
    title: "Settings",
    items: [
      ["/offline", "offline", "Offline", "Save everything on the phone"],
      ["/admin", "clipboard", "Question bank", "Questions, past-paper import"],
      ["/settings", "gear", "Settings", "Name, target exam, date"],
    ],
  },
];

export default function More() {
  return (
    <div className="space-y-5">
      <InstallApp />
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">{g.title}</h2>
          <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
            {g.items.map(([href, icon, title, sub]) => (
              <Link key={href} href={href} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 active:bg-stone-50">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${TINT[icon] ?? "from-amber-100 to-orange-50"}`} aria-hidden>
                  {icon === "அ" ? <span className="text-[22px] font-bold text-maroon-700">அ</span> : <Emoji name={icon as EmojiName} size={28} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{title}</span>
                  <span className="block truncate text-[13px] text-stone-500">{sub}</span>
                </span>
                <span className="text-xl text-stone-300">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <div className="relative overflow-hidden rounded-2xl bg-maroon-900 text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/murugan/sannidhi.webp" alt="முருகன் சந்நிதி" className="h-56 w-full object-cover object-top opacity-90" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-maroon-900 to-transparent p-3">
          <p className="font-bold text-gold-400">ஆறுபடை வீடு கொண்டவனே போற்றி</p>
          <p className="text-xs text-white/80">ஓம் சரவணபவ</p>
        </div>
      </div>
    </div>
  );
}
