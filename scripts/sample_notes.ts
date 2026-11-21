// Prints a few finished lesson notes of one kind (default: mindmap), one per subject, for a quality look.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
const admin = supabaseAdmin();
const kind = process.env.SAMPLE_KIND || "mindmap";
const { data: notes } = await admin.from("chapter_notes").select("chapter_id,content").eq("kind", kind).limit(400);
const { count } = await admin.from("chapter_notes").select("chapter_id", { count: "exact", head: true }).eq("kind", kind);
const ids = (notes ?? []).map((n) => n.chapter_id);
const { data: chs } = await admin.from("chapters").select("id,std,subject,title_ta").in("id", ids.slice(0, 400));
const bySubj = new Map<string, unknown[]>();
for (const n of notes ?? []) {
  const c = chs?.find((x) => x.id === n.chapter_id); if (!c) continue;
  const k = c.subject; if ((bySubj.get(k)?.length ?? 0) >= 2) continue;
  bySubj.set(k, [...(bySubj.get(k) ?? []), { ...c, content: n.content }]);
}
console.log(`TOTAL ${kind}: ${count}`);
console.log("SAMPLES_JSON " + JSON.stringify([...bySubj.values()].flat()));
