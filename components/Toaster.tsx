"use client";
// App-style toast messages (instead of browser alert boxes). Use toast("…") from lib/toast.
import { useEffect, useState } from "react";
import { Vel } from "@/components/Murugan";

export default function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 4500);
    };
    window.addEventListener("app-toast", on);
    return () => window.removeEventListener("app-toast", on);
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md animate-[fadein_.25s_ease] md:bottom-6" role="status" onClick={() => setMsg(null)}>
      <div className="flex items-center gap-3 rounded-2xl bg-maroon-700 px-4 py-3 text-[15px] text-white shadow-xl">
        <Vel className="h-7 shrink-0" gold="#ffd76a" dark="#8a5a00" />
        <span>{msg}</span>
      </div>
    </div>
  );
}
