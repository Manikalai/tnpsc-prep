"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** POSTs JSON to an API route; on success follows `redirect` from the response or refreshes. */
export default function StartButton({
  url,
  body,
  label,
  busyLabel = "தயாராகிறது…",
  className = "btn",
  confirm,
}: {
  url: string;
  body?: unknown;
  label: string;
  busyLabel?: string;
  className?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="inline-flex flex-col gap-1">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `பிழை ${res.status}`);
            if (data.notice) window.alert(data.notice);
            if (data.redirect) router.push(data.redirect);
            else router.refresh();
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? busyLabel : label}
      </button>
      {err && <span className="text-xs text-kumkum-500">{err}</span>}
    </div>
  );
}
