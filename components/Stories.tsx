// Instagram-style "stories" row: round shortcuts with a glowing ring; the ring lights up when something
// is waiting (new current affairs, revision due, flashcards due).
import Link from "next/link";

export type Story = { href: string; label: string; icon: string; badge?: number; live?: boolean };

export default function Stories({ items }: { items: Story[] }) {
  return (
    <div className="-mx-4 flex snap-x scroll-px-4 gap-3.5 overflow-x-auto px-4 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((s) => (
        <Link key={s.href} href={s.href} className="group flex w-[68px] shrink-0 snap-start flex-col items-center gap-1.5">
          <span className={`relative grid h-[66px] w-[66px] place-items-center rounded-full p-[3px] transition group-active:scale-90 ${s.live ? "bg-[conic-gradient(from_200deg,#f59e0b,#c2410c,#7a1414,#ffd76a,#f59e0b)]" : "bg-stone-200"}`}>
            <span className="grid h-full w-full place-items-center rounded-full border-[2.5px] border-[#fbf4e8] bg-gradient-to-br from-white to-amber-50 text-[26px] shadow-inner">{s.icon}</span>
            {!!s.badge && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[22px] rounded-full border-2 border-[#fbf4e8] bg-kumkum-500 px-1.5 text-center text-[11px] font-bold leading-[18px] text-white">{s.badge > 99 ? "99+" : s.badge}</span>
            )}
          </span>
          <span className="w-full truncate text-center text-[11.5px] font-medium text-stone-700">{s.label}</span>
        </Link>
      ))}
    </div>
  );
}
