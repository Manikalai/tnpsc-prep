"use client";
// 🔊 Listen: the phone's own Tamil voice reads the text on screen (free, works offline, nothing downloaded).
// It reads the element given by `target` (so no extra copy of the text), sentence by sentence
// (long texts are cut off by some phones otherwise), with speed control.
import { useEffect, useRef, useState } from "react";
import { IconVolume, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-react";

const SPEEDS = [0.8, 1, 1.2, 1.5];

function tamilVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  return vs.find((v) => v.lang === "ta-IN") ?? vs.find((v) => v.lang?.startsWith("ta")) ?? null;
}

function chunks(text: string) {
  const parts = text.replace(/\s+/g, " ").split(/(?<=[.!?।|:;])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).length > 220 && cur) { out.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur.trim()) out.push(cur);
  return out.filter((c) => c.trim().length > 1);
}

export default function ListenButton({ target, text }: { target?: string; text?: string }) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [speed, setSpeed] = useState(1);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported("speechSynthesis" in window);
    try { const v = Number(localStorage.getItem("ttsSpeed")); if (v) setSpeed(v); } catch {}
  }, []);
  const [note, setNote] = useState("");
  const queue = useRef<string[]>([]), idx = useRef(0), run = useRef(0);

  const stop = () => { run.current++; window.speechSynthesis?.cancel(); setState("idle"); };
  useEffect(() => () => { run.current++; if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  const saveSpeed = (v: number) => { setSpeed(v); try { localStorage.setItem("ttsSpeed", String(v)); } catch {} };

  const speakFrom = (i: number, rate: number) => {
    const my = ++run.current;
    const synth = window.speechSynthesis;
    synth.cancel();
    const voice = tamilVoice();
    const next = (k: number) => {
      if (my !== run.current) return;
      if (k >= queue.current.length) { setState("idle"); return; }
      idx.current = k;
      const u = new SpeechSynthesisUtterance(queue.current[k]);
      u.lang = "ta-IN"; u.rate = rate; if (voice) u.voice = voice;
      u.onend = () => next(k + 1);
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") next(k + 1); };
      synth.speak(u);
    };
    setState("playing");
    next(i);
  };

  const play = () => {
    if (!supported) { setNote("இந்தக் கைப்பேசியில் வாசிக்கும் வசதி இல்லை."); return; }
    const src = text ?? (target ? document.getElementById(target)?.innerText : "") ?? "";
    queue.current = chunks(src);
    if (!queue.current.length) return;
    if (!tamilVoice()) setNote("தமிழ்க் குரல் இல்லையெனில்: Settings → Google Text-to-speech → Tamil குரலைப் பதிவிறக்குங்கள்.");
    speakFrom(0, speed);
  };
  const pause = () => { window.speechSynthesis.pause(); setState("paused"); };
  const resume = () => {
    // some Android phones do not resume after pause: restart the current sentence
    window.speechSynthesis.resume();
    setTimeout(() => { if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) speakFrom(idx.current, speed); }, 250);
    setState("playing");
  };
  const changeSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    saveSpeed(s);
    if (state === "playing") speakFrom(idx.current, s);
  };

  if (!supported) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "idle" ? (
        <button onClick={play} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-maroon-600 to-saffron-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm active:scale-95">
          <IconVolume size={18} /> Listen
        </button>
      ) : (
        <>
          <button onClick={state === "playing" ? pause : resume} className="grid h-9 w-9 place-items-center rounded-full bg-maroon-600 text-white active:scale-95" aria-label={state === "playing" ? "Pause" : "Play"}>
            {state === "playing" ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}
          </button>
          <button onClick={stop} className="grid h-9 w-9 place-items-center rounded-full bg-stone-200 text-stone-700 active:scale-95" aria-label="Stop"><IconPlayerStopFilled size={16} /></button>
          <span className="text-xs text-stone-500">{idx.current + 1}/{queue.current.length}</span>
        </>
      )}
      <button onClick={changeSpeed} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700 active:scale-95" aria-label="Speed">{speed}×</button>
      {note && <p className="w-full text-xs text-stone-500">{note}</p>}
    </div>
  );
}
