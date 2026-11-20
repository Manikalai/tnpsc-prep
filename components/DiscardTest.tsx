"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";

// delete an unfinished test (e.g. a mock started by mistake) — it never counts anywhere
export default function DiscardTest({ testId }: { testId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!window.confirm("இந்தத் தேர்வை நீக்கவா? இது மதிப்பெண்ணில் சேராது.")) return;
    setBusy(true);
    await fetch("/api/test/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, action: "discard" }) }).catch(() => {});
    try { localStorage.removeItem(`test-${testId}`); } catch {}
    router.refresh();
  };
  return (
    <button onClick={go} disabled={busy} aria-label="Discard test" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-400 active:bg-kumkum-50 active:text-kumkum-500">
      <IconTrash size={18} />
    </button>
  );
}
