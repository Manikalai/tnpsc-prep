"use client";
import { useRouter } from "next/navigation";

export default function UnitPicker({ units, unitId, topics, topicId }: { units: { id: string; name: string }[]; unitId?: string; topics: { id: string; name_ta: string }[]; topicId?: string }) {
  const router = useRouter();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select className="input" value={unitId} onChange={(e) => router.push(`?unit=${e.target.value}`)}>
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select className="input" value={topicId ?? ""} onChange={(e) => router.push(`?unit=${unitId}${e.target.value ? `&topic=${e.target.value}` : ""}`)}>
        <option value="">முழு அலகு</option>
        {topics.map((t) => <option key={t.id} value={t.id}>{t.name_ta}</option>)}
      </select>
    </div>
  );
}
