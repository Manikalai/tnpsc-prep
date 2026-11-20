"use client";
// Settings → voice for 🔊 Listen. Each voice has a ▶ preview; the choice is remembered on this phone.
import { useEffect, useRef, useState } from "react";
import { IconPlayerPlayFilled, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { PICKABLE, VOICE_NOTE } from "@/lib/voices";
import { cloud } from "@/components/ListenButton";

const SAMPLE = "வணக்கம் சரண்யா! இன்று சோழர்கள் பாடத்தைப் படிப்போம். வெற்றி வேல், வீர வேல்!";

export default function VoicePicker() {
  const [voice, setVoice] = useState<string>("Kore");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { try { setVoice(localStorage.getItem("ttsVoice") || "Kore"); } catch {} }, []);
  const choose = (v: string) => { setVoice(v); try { localStorage.setItem("ttsVoice", v); } catch {} };
  const preview = async (v: string) => {
    setBusy(v); setMsg("");
    const url = await cloud(SAMPLE, v);
    setBusy(null);
    if (!url) { setMsg("இயல்பான குரல் இப்போது கிடைக்கவில்லை (இணையம் அல்லது மாத வரம்பு)."); return; }
    audio.current?.pause();
    audio.current = new Audio(url);
    void audio.current.play();
  };
  return (
    <div className="divide-y divide-stone-100">
      {PICKABLE.map((v) => (
        <div key={v} className="flex items-center gap-3 py-2.5">
          <button onClick={() => choose(v)} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${voice === v ? "border-saffron-500 bg-saffron-500 text-white" : "border-stone-300"}`} aria-label={`Use ${v}`}>
            {voice === v && <IconCheck size={14} stroke={3} />}
          </button>
          <button onClick={() => choose(v)} className="min-w-0 flex-1 text-left">
            <span className="block font-semibold">{v}{v === "Kore" ? " · default" : ""}</span>
            <span className="block text-xs text-stone-500">{VOICE_NOTE[v]}</span>
          </button>
          <button onClick={() => preview(v)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-maroon-600 to-saffron-500 text-white active:scale-95" aria-label={`Preview ${v}`}>
            {busy === v ? <IconLoader2 size={18} className="animate-spin" /> : <IconPlayerPlayFilled size={16} />}
          </button>
        </div>
      ))}
      {msg && <p className="pt-2 text-xs text-stone-500">{msg}</p>}
    </div>
  );
}
