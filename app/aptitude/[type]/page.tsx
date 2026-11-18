import { notFound } from "next/navigation";
import { aptType } from "@/lib/aptitude";
import AptitudeDrill from "@/components/AptitudeDrill";

export default async function AptType({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const t = aptType(type);
  if (!t) notFound();
  return (
    <div className="space-y-4">
      <h1 className="h1">{t.name}</h1>
      <div className="card">
        <h2 className="h2">வழிமுறை</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">{t.method.map((m, k) => <li key={k}>{m}</li>)}</ul>
        <h2 className="h2 mt-4">சுருக்கு வழிகள்</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">{t.shortcuts.map((m, k) => <li key={k}>{m}</li>)}</ul>
      </div>
      <AptitudeDrill keys={[t.key]} n={10} title={`${t.name} – 10 வினாக்கள்`} seconds={10 * 60} />
    </div>
  );
}
