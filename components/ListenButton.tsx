"use client";
// 🔊 Listen. Natural Tamil voice (Google Chirp 3 HD via /api/tts, each piece made once and cached);
// falls back to the phone's own Tamil voice when offline, without a key, or past the monthly free limit.
// Reads the element given by `target` (no extra copy of the text), piece by piece, next piece fetched while one plays.
import { useEffect, useRef, useState } from "react";
import { IconVolume, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-react";

const SPEEDS = [0.8, 1, 1.2, 1.5];

function tamilVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  return vs.find((v) => v.lang === "ta-IN") ?? vs.find((v) => v.lang?.startsWith("ta")) ?? null;
}

function chunks(text: string, max: number) {
  const parts = text.replace(/\s+/g, " ").split(/(?<=[.!?।|:;])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).length > max && cur) { out.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p;
    while (cur.length > max * 1.3) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur.trim()) out.push(cur);
  return out.filter((c) => c.trim().length > 1);
}

type Src = { url?: string; audio?: string; fallback?: boolean };
async function cloud(text: string): Promise<string | null> {
  try {
    const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const j = (await r.json()) as Src;
    if (j.url) return j.url;
    if (j.audio) return `data:audio/mpeg;base64,${j.audio}`;
  } catch { /* offline */ }
  return null;
}

export default function ListenButton({ target, text }: { target?: string; text?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [speed, setSpeed] = useState(1);
  const [pos, setPos] = useState({ i: 0, n: 0 });
  const [note, setNote] = useState("");
  const [natural, setNatural] = useState(false);
  const run = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<string[]>([]);
  const urls = useRef<Map<number, Promise<string | null>>>(new Map());
  const speedRef = useRef(1);

  useEffect(() => {
    try { const v = Number(localStorage.getItem("ttsSpeed")); if (v) { setSpeed(v); speedRef.current = v; } } catch {}
    return () => { run.current++; audio.current?.pause(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  const getUrl = (k: number) => {
    if (!urls.current.has(k)) urls.current.set(k, cloud(queue.current[k]));
    return urls.current.get(k)!;
  };

  // ---------- phone voice (fallback) ----------
  const device = (from: number, my: number) => {
    const synth = window.speechSynthesis;
    if (!synth) { setNote("இந்தக் கைப்பேசியில் வாசிக்கும் வசதி இல்லை."); setState("idle"); return; }
    const small = chunks(queue.current.slice(from).join(" "), 220);
    const voice = tamilVoice();
    if (!voice) setNote("தமிழ்க் குரல் இல்லையெனில்: Settings → Google Text-to-speech → Tamil குரலைப் பதிவிறக்குங்கள்.");
    setNatural(false);
    const next = (k: number) => {
      if (my !== run.current) return;
      if (k >= small.length) { setState("idle"); return; }
      setPos({ i: k, n: small.length });
      const u = new SpeechSynthesisUtterance(small[k]);
      u.lang = "ta-IN"; u.rate = speedRef.current; if (voice) u.voice = voice;
      u.onend = () => next(k + 1);
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") next(k + 1); };
      synth.speak(u);
    };
    setState("playing");
    next(0);
  };

  // ---------- natural voice ----------
  const playFrom = async (k: number, my: number) => {
    if (my !== run.current) return;
    if (k >= queue.current.length) { setState("idle"); return; }
    setPos({ i: k, n: queue.current.length });
    if (state !== "playing") setState("loading");
    const url = await getUrl(k);
    if (my !== run.current) return;
    if (!url) { device(k, my); return; } // no natural voice now: carry on with the phone's
    if (k + 1 < queue.current.length) void getUrl(k + 1); // fetch the next piece while this one plays
    const a = audio.current ?? (audio.current = new Audio());
    a.src = url;
    a.playbackRate = speedRef.current;
    a.onended = () => playFrom(k + 1, my);
    a.onerror = () => device(k, my);
    try { await a.play(); setNatural(true); setState("playing"); } catch { device(k, my); }
  };

  const play = () => {
    const src = text ?? (target ? document.getElementById(target)?.innerText : "") ?? "";
    queue.current = chunks(src, 1200);
    urls.current = new Map();
    if (!queue.current.length) return;
    setNote("");
    const my = ++run.current;
    void playFrom(0, my);
  };
  const stop = () => { run.current++; audio.current?.pause(); window.speechSynthesis?.cancel(); setState("idle"); };
  const pause = () => { if (natural) audio.current?.pause(); else window.speechSynthesis?.pause(); setState("paused"); };
  const resume = () => {
    if (natural) { void audio.current?.play(); setState("playing"); return; }
    window.speechSynthesis.resume(); setState("playing");
  };
  const changeSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s); speedRef.current = s;
    try { localStorage.setItem("ttsSpeed", String(s)); } catch {}
    if (audio.current) audio.current.playbackRate = s;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "idle" ? (
        <button onClick={play} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-maroon-600 to-saffron-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm active:scale-95">
          <IconVolume size={18} /> Listen
        </button>
      ) : state === "loading" ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3.5 py-1.5 text-sm text-stone-600">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-saffron-500 border-t-transparent" /> குரல் தயாராகிறது…
        </span>
      ) : (
        <>
          <button onClick={state === "playing" ? pause : resume} className="grid h-9 w-9 place-items-center rounded-full bg-maroon-600 text-white active:scale-95" aria-label={state === "playing" ? "Pause" : "Play"}>
            {state === "playing" ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}
          </button>
          <button onClick={stop} className="grid h-9 w-9 place-items-center rounded-full bg-stone-200 text-stone-700 active:scale-95" aria-label="Stop"><IconPlayerStopFilled size={16} /></button>
          <span className="text-xs text-stone-500">{pos.i + 1}/{pos.n}{natural ? " · ✨" : ""}</span>
        </>
      )}
      <button onClick={changeSpeed} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700 active:scale-95" aria-label="Speed">{speed}×</button>
      {note && <p className="w-full text-xs text-stone-500">{note}</p>}
    </div>
  );
}
