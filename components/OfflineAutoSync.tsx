"use client";
import { useEffect } from "react";

// Quietly keeps the offline copy fresh: when the app opens with internet and the last update is >4 hours old.
export default function OfflineAutoSync() {
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!navigator.onLine) return;
        // keep the offline practice page + its code saved on the phone, so the app opens with no internet
        try {
          const last = Number(localStorage.getItem("swWarm") || 0);
          if (Date.now() - last > 12 * 3600e3 && navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage("warm");
            localStorage.setItem("swWarm", String(Date.now()));
          }
        } catch {}
        const { getSettings, incrementalSync, syncAttempts } = await import("@/lib/offline-sync");
        await syncAttempts().catch(() => 0);
        const s = await getSettings();
        if (!s.auto || !s.lastSync) return;
        if (Date.now() - new Date(s.lastSync).getTime() < 4 * 3600e3) return;
        await incrementalSync();
      } catch {
        /* try again next time */
      }
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
