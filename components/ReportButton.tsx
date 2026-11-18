"use client";
import { useState } from "react";

export default function ReportButton({ questionId }: { questionId: string }) {
  const [done, setDone] = useState(false);
  if (done) return <span className="text-xs text-stone-500">நன்றி — சரிபார்க்கப் பதிவு செய்யப்பட்டது</span>;
  return (
    <button
      className="text-xs text-kumkum-500 underline"
      onClick={async () => {
        const reason = window.prompt("என்ன தவறு? (விடை தவறு / வினா தெளிவில்லை / தமிழ் பிழை …)") ?? "";
        if (!reason) return;
        await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, reason }) });
        setDone(true);
      }}
    >
      பிழை எனப் புகாரளி
    </button>
  );
}
