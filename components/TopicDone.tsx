"use client";
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

// tick a plan topic as done (saved to her syllabus progress); the plan re-spreads the rest
export default function TopicDone({ topicId }: { topicId: string }) {
  const [on, setOn] = useState(false);
  const router = useRouter();
  const toggle = async () => {
    const next = !on; setOn(next);
    try {
      await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId, status: next ? "done" : "studying" }) });
      if (next) setTimeout(() => router.refresh(), 900);
    } catch { setOn(!next); }
  };
  return (
    <button onClick={toggle} aria-label="Mark done" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-stone-300 text-transparent"}`}>
      <IconCheck size={16} stroke={3} />
    </button>
  );
}
