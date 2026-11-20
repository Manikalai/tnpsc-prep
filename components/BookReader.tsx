"use client";
// Kindle-style textbook reader: one page at a time, full screen.
// - white margins trimmed automatically so the Tamil text fills the phone width
// - swipe ← → to turn pages; pinch or double-tap to zoom, drag to move; slider to jump
// - Day / Sepia / Night; remembers the last page of each lesson on this phone
import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut, IconSun, IconMoon, IconCoffee } from "@tabler/icons-react";

export type Crop = { x: number; y: number; w: number; h: number; r: number }; // fractions of the image; r = width/height of the image
const cropCache = new Map<string, Crop>();

/** finds the printed area of a page (trims white margins) — falls back to the full page */
export function useCrop(src: string): [Crop | null, (img: HTMLImageElement) => void] {
  const [crop, setCrop] = useState<Crop | null>(cropCache.get(src) ?? null);
  const onLoad = useCallback((img: HTMLImageElement) => {
    if (cropCache.has(src)) return setCrop(cropCache.get(src)!);
    const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
    let c: Crop = { x: 0, y: 0, w: 1, h: 1, r: ratio };
    try {
      const W = 160, H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const ink = (x: number, y: number) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 660; };
      const rowInk = (y: number) => { let n = 0; for (let x = 0; x < W; x++) if (ink(x, y)) n++; return n; };
      const colInk = (x: number) => { let n = 0; for (let y = 0; y < H; y++) if (ink(x, y)) n++; return n; };
      let t = 0, b = H - 1, l = 0, r = W - 1;
      while (t < H / 3 && rowInk(t) < 2) t++;
      while (b > (2 * H) / 3 && rowInk(b) < 2) b--;
      while (l < W / 3 && colInk(l) < 2) l++;
      while (r > (2 * W) / 3 && colInk(r) < 2) r--;
      const pad = 3; // keep a little breathing room
      l = Math.max(0, l - pad); r = Math.min(W - 1, r + pad); t = Math.max(0, t - pad); b = Math.min(H - 1, b + pad);
      if (r - l > W * 0.45 && b - t > H * 0.45) c = { x: l / W, y: t / H, w: (r - l + 1) / W, h: (b - t + 1) / H, r: ratio };
    } catch { /* image not readable (no CORS): show full page */ }
    cropCache.set(src, c);
    setCrop(c);
  }, [src]);
  return [crop, onLoad];
}

/** a page image with its margins trimmed (pure CSS crop) */
export function CroppedPage({ src, alt, onClick, eager }: { src: string; alt: string; onClick?: () => void; eager?: boolean }) {
  const [crop, onLoad] = useCrop(src);
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1, r: 0.72 };
  return (
    <div onClick={onClick} className="relative w-full overflow-hidden bg-white" style={{ aspectRatio: `${c.w * c.r} / ${c.h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src} alt={alt} crossOrigin="anonymous" loading={eager ? "eager" : "lazy"} decoding="async" draggable={false}
        onLoad={(e) => onLoad(e.currentTarget)}
        className="absolute max-w-none select-none"
        style={{ width: `${100 / c.w}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, height: `${100 / c.h}%` }}
      />
    </div>
  );
}

type Theme = "day" | "sepia" | "night";
const THEME: Record<Theme, { bg: string; bar: string; page: string }> = {
  day: { bg: "bg-stone-200", bar: "bg-white/95 text-stone-800", page: "" },
  sepia: { bg: "bg-[#efe3c8]", bar: "bg-[#f7eedb]/95 text-[#5b4636]", page: "sepia-[.35] contrast-[1.02]" },
  night: { bg: "bg-black", bar: "bg-stone-900/95 text-stone-100", page: "invert-[.9] hue-rotate-180 contrast-[.95]" },
};

export default function BookReader({ pages, urlOf, start, storeKey, onClose }: {
  pages: number[]; urlOf: (p: number) => string; start: number; storeKey: string; onClose: () => void;
}) {
  const [i, setI] = useState(() => Math.max(0, pages.indexOf(start)));
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem("readerTheme") as Theme) || "day"; } catch { return "day"; } });
  const [z, setZ] = useState({ s: 1, x: 0, y: 10000 }); // zoom + pan (px); starts at the top of the page
  const [chrome, setChrome] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ d0?: number; s0?: number; x0?: number; y0?: number; sx?: number; sy?: number; moved?: boolean; t?: number; lastTap?: number }>({});

  const go = useCallback((d: number) => {
    setI((v) => Math.min(pages.length - 1, Math.max(0, v + d)));
    setZ({ s: 1, x: 0, y: 10000 }); // clamped to the top once the page has a size
  }, [pages.length]);

  // remember page; keyboard; lock page scroll behind the reader
  useEffect(() => { try { localStorage.setItem(`read:${storeKey}`, String(pages[i])); } catch {} }, [i, pages, storeKey]);
  useEffect(() => { try { localStorage.setItem("readerTheme", theme); } catch {} }, [theme]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, [go, onClose]);

  // keep the page on screen: sideways only when zoomed; up/down whenever the page is taller than the screen
  const clamp = (s: number, x: number, y: number) => {
    const el = box.current; if (!el) return { s, x, y };
    const W = el.offsetWidth, H = el.offsetHeight, VH = el.parentElement?.clientHeight ?? window.innerHeight;
    const mx = ((s - 1) * W) / 2, my = Math.max(0, (H * s - VH) / 2 + 70);
    return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  const tall = () => { const el = box.current; return !!el && el.offsetHeight > (el.parentElement?.clientHeight ?? 0) - 40; };

  const down = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const P = [...pts.current.values()];
    if (P.length === 2) g.current = { ...g.current, d0: Math.hypot(P[0].x - P[1].x, P[0].y - P[1].y), s0: z.s, x0: z.x, y0: z.y, moved: true };
    else g.current = { ...g.current, sx: e.clientX, sy: e.clientY, x0: z.x, y0: z.y, moved: false, t: Date.now() };
  };
  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const P = [...pts.current.values()], G = g.current;
    if (P.length === 2 && G.d0) {
      const s = Math.min(4, Math.max(1, (G.s0! * Math.hypot(P[0].x - P[1].x, P[0].y - P[1].y)) / G.d0));
      setZ(clamp(s, G.x0! * (s / G.s0!), G.y0! * (s / G.s0!)));
    } else if (P.length === 1 && G.sx != null) {
      const dx = e.clientX - G.sx, dy = e.clientY - G.sy!;
      if (Math.abs(dx) + Math.abs(dy) > 8) G.moved = true;
      if (z.s > 1.02) setZ(clamp(z.s, G.x0! + dx, G.y0! + dy));
      else if (tall() && Math.abs(dy) > Math.abs(dx)) setZ(clamp(1, 0, G.y0! + dy));
    }
  };
  const up = (e: React.PointerEvent) => {
    const G = g.current, wasPinch = pts.current.size === 2;
    pts.current.delete(e.pointerId);
    if (wasPinch) { G.d0 = undefined; if (z.s < 1.05) setZ({ s: 1, x: 0, y: 0 }); return; }
    if (G.sx == null) return;
    const dx = e.clientX - G.sx, dy = e.clientY - G.sy!, fast = Date.now() - (G.t ?? 0) < 500;
    if (z.s <= 1.02 && G.moved && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { go(dx < 0 ? 1 : -1); G.sx = undefined; return; }
    if (!G.moved && fast) {
      const now = Date.now();
      if (G.lastTap && now - G.lastTap < 300) {
        // double tap: zoom into that spot / back to fit
        G.lastTap = 0;
        if (z.s > 1.05) setZ(clamp(1, 0, 0));
        else {
          const r = box.current!.getBoundingClientRect(), s = 2.2;
          setZ(clamp(s, (r.left + r.width / 2 - e.clientX) * (s - 1), (r.top + r.height / 2 - e.clientY) * (s - 1)));
        }
      } else {
        G.lastTap = now;
        const tapX = e.clientX, w = window.innerWidth;
        setTimeout(() => {
          if (g.current.lastTap !== now) return; // became a double tap
          if (z.s > 1.02) return;
          if (tapX < w * 0.22) go(-1); else if (tapX > w * 0.78) go(1); else setChrome((c) => !c);
        }, 280);
      }
    }
    G.sx = undefined;
  };

  // after a page loads, snap it into its allowed area (top of a tall page)
  useEffect(() => { const t = setTimeout(() => setZ((v) => clamp(v.s, v.x, v.y)), 120); return () => clearTimeout(t); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const T = THEME[theme], p = pages[i];
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col ${T.bg}`} style={{ touchAction: "none" }}>
      {/* top bar */}
      <div className={`absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] shadow-sm backdrop-blur transition-transform duration-200 ${T.bar} ${chrome ? "" : "-translate-y-full"}`}>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full active:bg-black/10" aria-label="Close"><IconX size={24} /></button>
        <span className="flex-1 text-center text-[15px] font-semibold">பக்கம் {p} <span className="opacity-60">· {i + 1}/{pages.length}</span></span>
        {(["day", "sepia", "night"] as Theme[]).map((t) => {
          const I = t === "day" ? IconSun : t === "sepia" ? IconCoffee : IconMoon;
          return <button key={t} onClick={() => setTheme(t)} aria-label={t} className={`grid h-9 w-9 place-items-center rounded-full ${theme === t ? "bg-saffron-500 text-white" : "active:bg-black/10"}`}><I size={19} /></button>;
        })}
      </div>

      {/* page */}
      <div className="relative flex-1 overflow-hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="flex h-full items-center">
          <div ref={box} className="mx-auto w-full max-w-3xl will-change-transform" style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`, transition: pts.current.size ? "none" : "transform .18s ease-out" }}>
            <div className={`shadow-xl ${T.page}`}><CroppedPage key={p} src={urlOf(p)} alt={`பக்கம் ${p}`} eager /></div>
          </div>
        </div>
        {/* preload neighbours */}
        <div className="hidden">{[pages[i + 1], pages[i + 2], pages[i - 1]].filter(Boolean).map((n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={n} src={urlOf(n!)} crossOrigin="anonymous" alt="" />
        ))}</div>
      </div>

      {/* bottom bar */}
      <div className={`absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur transition-transform duration-200 ${T.bar} ${chrome ? "" : "translate-y-full"}`}>
        <button onClick={() => go(-1)} disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30 active:bg-black/10" aria-label="Previous page"><IconChevronLeft size={24} /></button>
        <input type="range" min={0} max={pages.length - 1} value={i} onChange={(e) => { setI(Number(e.target.value)); setZ({ s: 1, x: 0, y: 0 }); }} className="flex-1 accent-saffron-500" aria-label="Page" />
        <button onClick={() => setZ(z.s > 1.02 ? { s: 1, x: 0, y: 0 } : clamp(2, 0, 0))} className="grid h-10 w-10 place-items-center rounded-full active:bg-black/10" aria-label="Zoom">{z.s > 1.02 ? <IconZoomOut size={22} /> : <IconZoomIn size={22} />}</button>
        <button onClick={() => go(1)} disabled={i === pages.length - 1} className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30 active:bg-black/10" aria-label="Next page"><IconChevronRight size={24} /></button>
      </div>
    </div>
  );
}
