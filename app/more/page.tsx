import Link from "next/link";
import InstallApp from "@/components/InstallApp";

const GROUPS: { title: string; items: [string, string, string, string][] }[] = [
  {
    title: "Study",
    items: [
      ["/books", "📚", "Textbooks", "Class → Term → Lesson"],
      ["/syllabus", "🗂️", "Syllabus", "Progress by unit"],
      ["/timeline", "⏳", "Years & events", "Timeline across subjects, memory tricks"],
      ["/notes", "📝", "Memory notes", "Mnemonics, summaries, tables"],
      ["/tamil", "அ", "General Tamil", "100 of 200 questions: grammar, Thirukkural, books & authors"],
      ["/aptitude", "🧮", "Aptitude", "10 topics, shortcuts"],
      ["/ask", "💬", "Ask the textbook", "Doubts answered from the textbook"],
    ],
  },
  {
    title: "Practice",
    items: [
      ["/papers", "📄", "TNPSC previous papers", "Past years, timed"],
      ["/revision", "🔁", "Revision", "Missed questions after 1, 3, 7, 15 days"],
      ["/flashcards", "🃏", "Flashcards", "Quick revision"],
      ["/mains", "✍️", "Mains", "Group 1 answer writing"],
    ],
  },
  {
    title: "Plan & progress",
    items: [
      ["/planner", "🗓️", "Study plan", "Targets up to the exam date"],
      ["/analysis", "📊", "Analysis", "Weak units"],
    ],
  },
  {
    title: "Settings",
    items: [
      ["/offline", "📴", "Offline", "Save everything on the phone"],
      ["/admin", "🏦", "Question bank", "Questions, past-paper import"],
      ["/settings", "⚙️", "Settings", "Name, target exam, date"],
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
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-lg" aria-hidden>{icon}</span>
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
