"use client";
// "செயலியாக நிறுவு" — install the app from inside it (Android Chrome install prompt; iPhone instructions).
import { useEffect, useState } from "react";
import { Vel } from "@/components/Murugan";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallApp({ compact = false }: { compact?: boolean }) {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    setInstalled(!!standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const w = window as unknown as { __bip?: BIP };
    if (w.__bip) setEvt(w.__bip);
    const on = (e: Event) => { e.preventDefault(); w.__bip = e as BIP; setEvt(e as BIP); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed) return null;

  const click = async () => {
    if (evt) {
      await evt.prompt();
      const r = await evt.userChoice;
      if (r.outcome === "accepted") setInstalled(true);
      setEvt(null);
    } else setHelp(true);
  };

  return (
    <div className={`overflow-hidden rounded-2xl bg-gradient-to-r from-maroon-700 to-saffron-500 text-white shadow ${compact ? "" : ""}`}>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15"><Vel className="h-8" gold="#ffd76a" dark="#8a5a00" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Saranya Prep செயலியாக நிறுவு</span>
          <span className="block text-[13px] text-white/85">முகப்புத் திரையில் ஐகான் · முழுத் திரை · இணையமின்றியும்</span>
        </span>
        <button onClick={click} className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-maroon-700 active:scale-95">நிறுவு</button>
      </div>
      {help && (
        <div className="space-y-1.5 bg-black/20 p-3.5 text-[14px]">
          {ios ? (
            <>
              <p>iPhone: <b>Safari</b>-இல் கீழே உள்ள <b>Share (□↑)</b> → <b>Add to Home Screen</b> → <b>Add</b>.</p>
            </>
          ) : (
            <>
              <p>Chrome: மேலே வலது <b>⋮</b> மெனு → <b>Install app</b> (அல்லது <b>Add to Home screen</b>) → <b>Install</b>.</p>
              <p className="text-white/75">“Install app” தெரியவில்லை எனில் பக்கத்தை ஒருமுறை புதுப்பித்து (reload) மீண்டும் முயலவும்.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
