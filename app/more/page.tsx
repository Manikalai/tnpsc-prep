import Link from "next/link";
import InstallApp from "@/components/InstallApp";

const GROUPS: { title: string; items: [string, string, string, string][] }[] = [
  {
    title: "படிக்க",
    items: [
      ["/books", "📚", "பாடநூல்கள்", "வகுப்பு → பருவம் → பாடம்"],
      ["/syllabus", "🗂️", "பாடத்திட்டம்", "அலகு வாரியாக முன்னேற்றம்"],
      ["/notes", "📝", "நினைவுக் குறிப்புகள்", "நினைவூட்டிகள், சுருக்கம், அட்டவணைகள்"],
      ["/aptitude", "🧮", "திறனறிவு", "10 தலைப்புகள், சுருக்கு வழிகள்"],
      ["/ask", "💬", "பாடநூலிடம் கேள்", "சந்தேகத்துக்கு பாடநூல் ஆதாரத்துடன் விடை"],
    ],
  },
  {
    title: "பயிற்சி",
    items: [
      ["/papers", "📄", "TNPSC உண்மை வினாத்தாள்கள்", "முந்தைய ஆண்டு, தேர்வு நேரத்துடன்"],
      ["/revision", "🔁", "திருப்புதல்", "தவறியவை 1, 3, 7, 15 நாட்களில்"],
      ["/flashcards", "🃏", "நினைவு அட்டைகள்", "விரைவுத் திருப்புதல்"],
      ["/mains", "✍️", "முதன்மைத் தேர்வு", "குரூப் 1 விடை எழுதுதல்"],
    ],
  },
  {
    title: "திட்டமும் முன்னேற்றமும்",
    items: [
      ["/planner", "🗓️", "படிப்புத் திட்டம்", "தேர்வு தேதி வரை இலக்கு"],
      ["/analysis", "📊", "பகுப்பாய்வு", "பலவீனமான அலகுகள்"],
    ],
  },
  {
    title: "அமைப்புகள்",
    items: [
      ["/offline", "📴", "இணையமின்றி", "எல்லாவற்றையும் கைப்பேசியில் சேமிக்க"],
      ["/admin", "🏦", "வினா வங்கி", "வினாக்கள், முந்தைய ஆண்டு இறக்குமதி"],
      ["/settings", "⚙️", "அமைப்புகள்", "பெயர், இலக்குத் தேர்வு, தேதி"],
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
