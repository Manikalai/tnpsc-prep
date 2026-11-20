"use client";
import { useEffect } from "react";
import { IconPrinter } from "@tabler/icons-react";

// "Download PDF": opens the phone's print screen (Save as PDF / printer). Optionally opens it by itself once fonts are ready.
export default function AutoPrint({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const go = () => setTimeout(() => window.print(), 400);
    if (document.fonts?.ready) document.fonts.ready.then(go); else go();
  }, [auto]);
  return (
    <button onClick={() => window.print()} className="btn inline-flex items-center gap-1.5">
      <IconPrinter size={18} /> Save as PDF / Print
    </button>
  );
}
