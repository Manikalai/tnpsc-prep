"use client";
import { useRouter } from "next/navigation";

/** Pick any date → that day's current affairs. */
export default function DateJump({ value, max }: { value?: string; max: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm font-semibold">📅 தேதி:</span>
      <input type="date" className="input max-w-[11rem] py-1.5" defaultValue={value} max={max} onChange={(e) => e.target.value && router.push(`/ca/${e.target.value}`)} />
    </label>
  );
}
