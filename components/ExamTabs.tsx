import Link from "next/link";
import { EXAM_LABEL } from "@/lib/data";

export default function ExamTabs({ base, current }: { base: string; current: string }) {
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto">
      {["G4", "G2", "G1"].map((c) => (
        <Link key={c} href={`${base}?exam=${c}`} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${c === current ? "bg-brand-500 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>
          {EXAM_LABEL[c]}
        </Link>
      ))}
    </div>
  );
}
