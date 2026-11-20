import { requireUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StartButton from "@/components/StartButton";
import type { NoolEntry } from "@/lib/tamil";
import NoolList from "@/components/NoolList";

export const dynamic = "force-dynamic";

// நூல் – ஆசிரியர்: every book/author pair named in her Tamil textbooks (checked against the lesson), by class.
export default async function NoolPage() {
  await requireUser();
  const admin = supabaseAdmin();
  const { data } = await admin.from("chapter_notes").select("content,chapters!inner(id,std,chapter_no,title_ta,book)").eq("kind", "tamil").limit(2000);
  const rows: (NoolEntry & { std: number; lesson: string })[] = [];
  const seen = new Set<string>();
  for (const r of (data ?? []) as unknown as { content: { nool?: NoolEntry[] }; chapters: { std: number; chapter_no: number; title_ta: string } }[]) {
    for (const n of r.content?.nool ?? []) {
      const k = `${n.nool}|${n.asiriyar}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ ...n, std: r.chapters.std, lesson: `${r.chapters.std}ஆம் வகுப்பு · பாடம் ${r.chapters.chapter_no}: ${r.chapters.title_ta}` });
    }
  }
  rows.sort((a, b) => a.std - b.std);
  return (
    <div className="space-y-3">
      <h1 className="h1">நூல் – ஆசிரியர்</h1>
      <p className="muted">உங்கள் தமிழ்ப் பாடநூல்களில் (நூல்வெளி) உள்ளபடி · {rows.length} நூல்கள்</p>
      <StartButton url="/api/tamil" body={{ topic: "nool" }} label="Quiz: நூல் – ஆசிரியர் (15)" busyLabel="Preparing…" className="btn w-full" />
      {rows.length ? <NoolList rows={rows} /> : <p className="card muted">தமிழ்ப் பாடங்களிலிருந்து நூல் – ஆசிரியர் பட்டியல் தயாராகிறது. சிறிது நேரத்தில் வரும்.</p>}
    </div>
  );
}
