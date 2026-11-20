"use client";
// Small touches that make the web app feel native: a light buzz on taps (Android), and the
// top bar tucks away while scrolling down and comes back on scroll up (html[data-scroll="down"]).
import { useEffect } from "react";

export default function AppFeel() {
  useEffect(() => {
    const tap = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest("button, .btn, .btn-ghost, nav a, [data-haptic]");
      if (t && "vibrate" in navigator) try { navigator.vibrate(7); } catch {}
    };
    let last = window.scrollY, ticking = false;
    const scroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY, d = y - last;
        if (y < 60 || d < -6) document.documentElement.dataset.scroll = "up";
        else if (d > 6) document.documentElement.dataset.scroll = "down";
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("pointerdown", tap, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    return () => { window.removeEventListener("pointerdown", tap); window.removeEventListener("scroll", scroll); };
  }, []);
  return null;
}
