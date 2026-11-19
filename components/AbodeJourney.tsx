// "ஆறுபடை வீடு பயணம்": her syllabus progress as a pilgrimage through Murugan's six abodes.
import { ABODES } from "@/lib/murugan";
import { Vel } from "@/components/Murugan";

function Gopuram({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 40 44" className="h-9 w-9" aria-hidden>
      <path d="M8 42h24l-2-8H10zM10 34h20l-2-7H12zM12 27h16l-2-7H14zM14 20h12l-2-7h-8zM16 13h8l-2-6h-4z" fill={lit ? "#e08a1e" : "#d6d3d1"} stroke={lit ? "#8a3b0f" : "#a8a29e"} strokeWidth="1" />
      <circle cx="20" cy="4.5" r="2.2" fill={lit ? "#f2c14e" : "#d6d3d1"} />
    </svg>
  );
}

export default function AbodeJourney({ pct }: { pct: number }) {
  const reached = Math.min(6, Math.floor(pct / (100 / 6)));
  const next = ABODES[Math.min(reached, 5)];
  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="h2">ஆறுபடை வீடு பயணம்</h2>
        <span className="chip bg-gold-400/20 text-maroon-700">{reached}/6</span>
      </div>
      <p className="muted">பாடத்திட்டத்தை முடிக்க முடிக்க ஒவ்வொரு படை வீடும் ஒளிரும்.</p>
      <ol className="mt-3 grid grid-cols-6 gap-1">
        {ABODES.map((a, i) => (
          <li key={a.name} className="flex flex-col items-center text-center">
            <div className="relative">
              <Gopuram lit={i < reached} />
              {i === reached && reached < 6 && <Vel className="absolute -right-2 -top-1 h-5 animate-[velglow_1.6s_ease-in-out_infinite]" />}
            </div>
            <span className={`mt-1 text-[10px] leading-tight ${i < reached ? "font-bold text-maroon-700" : "text-stone-400"}`}>{a.name}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-xl bg-saffron-400/10 p-2.5 text-[13.5px]">
        {reached >= 6 ? "ஆறுபடை வீடும் நிறைவு! ஆறுபடை வீடு கொண்டவனே போற்றி 🙏" : <>அடுத்த படை வீடு: <b>{next.name}</b> ({next.place}) — {next.note}</>}
      </p>
    </section>
  );
}
