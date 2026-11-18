"use client";
import { useState } from "react";
import { STATUS } from "@/lib/format";

const COLORS: Record<string, string> = {
  todo: "bg-stone-100 text-stone-600",
  studying: "bg-turmeric-50 text-turmeric-500",
  done: "bg-brand-50 text-brand-600",
  revised: "bg-brand-100 text-brand-700",
};

export default function StatusSelect({ topicId, initial }: { topicId: string; initial: string }) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <select
      aria-label="நிலை"
      value={v}
      disabled={saving}
      className={`rounded-lg border-0 px-2 py-1 text-xs font-semibold ${COLORS[v]}`}
      onChange={async (e) => {
        const s = e.target.value;
        setV(s);
        setSaving(true);
        await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId, status: s }) });
        setSaving(false);
      }}
    >
      {Object.entries(STATUS).map(([k, l]) => (
        <option key={k} value={k}>{l}</option>
      ))}
    </select>
  );
}
