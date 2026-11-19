"use client";
// Loading screen: a glowing Vel and Murugan slogans that change while the page loads.
import { useEffect, useState } from "react";
import { Vel } from "@/components/Murugan";
import { SLOGANS } from "@/lib/murugan";

export default function MuruganLoader({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * SLOGANS.length));
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SLOGANS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-14"}`} aria-busy="true">
      <div className="relative grid h-24 w-24 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-saffron-400/25" />
        <span className="absolute inset-2 rounded-full bg-gradient-to-br from-maroon-500 to-saffron-500 shadow-lg shadow-saffron-500/30" />
        <Vel className="relative h-16 animate-[velglow_1.6s_ease-in-out_infinite]" gold="#ffd76a" dark="#8a5a00" />
      </div>
      <p key={i} className="mt-4 animate-[fadein_.5s_ease] text-[17px] font-bold text-maroon-700">{SLOGANS[i]}</p>
      <p className="mt-1 text-xs text-stone-400">ஏற்றுகிறது…</p>
    </div>
  );
}
