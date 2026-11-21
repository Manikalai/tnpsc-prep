// Links every syllabus topic to the textbook lessons that teach it (6th–12th, within each exam's class limit).
// Per exam and textbook subject, lessons go to the AI in batches of 40 (title + the start of the lesson's summary)
// together with that exam's topics for the subject; it returns which topics each lesson really teaches.
// Result: Supabase Storage meta/topic-lessons.json  →  { exam: { topicId: [chapterId, …] }, lessons: { id: [std, subject, no, title] } }
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { generateJSON } from "../lib/ai";
import { EXAMS } from "../data/syllabus";

const admin = supabaseAdmin();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function all<T>(q: (a: number, b: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let f = 0; ; f += 1000) { const { data } = await q(f, f + 999); out.push(...((data ?? []) as T[])); if (!data || data.length < 1000) break; }
  return out;
}

type Ch = { id: number; book: string; std: number; subject: string; chapter_no: number; title_ta: string };
const chapters = await all<Ch>((a, b) => admin.from("chapters").select("id,book,std,subject,chapter_no,title_ta").order("id").range(a, b));
const summaries = new Map<number, string>();
for (const r of await all<{ chapter_id: number; content: { summary?: string } }>((a, b) => admin.from("chapter_notes").select("chapter_id,content").eq("kind", "summary").order("chapter_id").range(a, b)))
  summaries.set(r.chapter_id, String(r.content?.summary ?? "").replace(/[#*_>\n]+/g, " ").replace(/\s+/g, " ").slice(0, 200));
const units = await all<{ id: string; exam_code: string; name_ta: string; subject: string; source_subjects: string[] }>((a, b) => admin.from("units").select("id,exam_code,name_ta,subject,source_subjects").order("id").range(a, b));
const topics = await all<{ id: string; unit_id: string; name_ta: string }>((a, b) => admin.from("topics").select("id,unit_id,name_ta").order("unit_id").order("sort").range(a, b));

// textbook subject → the syllabus "source" group it belongs to
const group = (s: string) => {
  const x = s.toLowerCase();
  if (x === "tamil") return "tamil";
  if (x === "maths" || x === "mathematics") return "maths";
  if (["science", "physics", "chemistry", "botany", "zoology", "biology", "bio-botany", "bio-zoology"].includes(x)) return "science";
  if (x === "english") return "english";
  return "social"; // social, history, geography, economics, political science, ethics, …
};
console.log("lesson subjects:", [...new Set(chapters.map((c) => c.subject))].join(", "));

const maxStd = Object.fromEntries(EXAMS.map((e) => [e.code, e.maxStd]));
const out: { exams: Record<string, Record<string, number[]>>; lessons: Record<number, [number, string, number, string]>; made: string } = { exams: {}, lessons: {}, made: new Date().toISOString() };
const BATCH = Number(process.env.MAP_BATCH ?? 25);
const ONLY = (process.env.MAP_EXAMS ?? "").split(",").map((x) => x.trim()).filter(Boolean);

// keep what earlier runs already linked (only re-do the exams asked for)
const prev = await admin.storage.from("meta").download("topic-lessons.json").then(async (r) => (r.data ? (JSON.parse(await r.data.text()) as typeof out) : null)).catch(() => null);
if (prev?.exams) for (const [k, v] of Object.entries(prev.exams)) if (ONLY.length && !ONLY.includes(k)) out.exams[k] = v;

async function save() {
  out.lessons = {};
  for (const ids of Object.values(out.exams).flatMap((m) => Object.values(m))) for (const id of ids) {
    const c = chapters.find((x) => x.id === id);
    if (c) out.lessons[id] = [c.std, c.subject, c.chapter_no, c.title_ta];
  }
  const body = new Blob([JSON.stringify(out)], { type: "application/json" });
  let up = await admin.storage.from("meta").upload("topic-lessons.json", body, { upsert: true, contentType: "application/json", cacheControl: "300" });
  if (up.error) {
    await admin.storage.createBucket("meta", { public: true });
    up = await admin.storage.from("meta").upload("topic-lessons.json", body, { upsert: true, contentType: "application/json", cacheControl: "300" });
  }
  if (up.error) throw up.error;
}
let calls = 0, fails = 0;

for (const exam of Object.keys(maxStd).filter((e) => !ONLY.length || ONLY.includes(e))) {
  const map: Record<string, number[]> = {};
  out.exams[exam] = map; // saved even if the run stops partway
  const exUnits = units.filter((u) => u.exam_code === exam && u.subject !== "current" && u.subject !== "aptitude" && u.subject !== "reasoning");
  for (const g of ["social", "science", "tamil"]) {
    const gUnits = exUnits.filter((u) => (u.source_subjects ?? []).includes(g));
    const lessons = chapters.filter((c) => c.std <= maxStd[exam] && group(c.subject) === g);
    // one syllabus unit at a time (5–10 topics) so each request stays small enough for the free AI limits
    for (const unit of gUnits) {
      const gTopics = topics.filter((t) => t.unit_id === unit.id);
      if (!gTopics.length) continue;
      const topicList = gTopics.map((t, i) => `T${i}: ${t.name_ta}`).join("\n");
      for (let b = 0; b < lessons.length; b += BATCH) {
        const batch = lessons.slice(b, b + BATCH);
        const lessonList = batch.map((c) => `L${c.id}: ${c.std}ஆம் வகுப்பு · ${c.title_ta}${summaries.get(c.id) ? ` — ${summaries.get(c.id)!.slice(0, 120)}` : ""}`).join("\n");
        try {
          type Row = { lesson: string | number; topics: (string | number)[] };
          const { data } = await generateJSON<{ map: Row[] } | Row[]>({
            system: `You match Tamil Nadu school textbook lessons to TNPSC syllabus topics of ONE unit ("${unit.name_ta}"). For each lesson, list the topics it substantially TEACHES (a main subject of the lesson, not a passing mention). Most lessons will match none. Be strict: if unsure, leave it out. Return JSON {"map":[{"lesson":"L123","topics":["T2"]}]} with only lessons that match.`,
            user: `=== TOPICS ===\n${topicList}\n\n=== LESSONS ===\n${lessonList}`,
            temperature: 0,
            maxTokens: 1500,
          });
          calls++; fails = 0;
          const rows: Row[] = Array.isArray(data) ? data : Array.isArray(data?.map) ? data.map : [];
          for (const m of rows) {
            if (!m || typeof m !== "object") continue;
            const lid = Number(String(m.lesson).replace(/\D/g, ""));
            if (!batch.some((c) => c.id === lid)) continue;
            for (const t of Array.isArray(m.topics) ? m.topics : []) {
              const topic = gTopics[Number(String(t).replace(/\D/g, ""))];
              if (!topic) continue;
              (map[topic.id] ??= []).includes(lid) || map[topic.id].push(lid);
            }
          }
        } catch (e) {
          fails++;
          console.log(`${exam} · ${unit.id} · lessons ${b + 1}–${b + batch.length}: failed (${String(e).slice(0, 140)})`);
          if (fails >= 6) { await save(); throw new Error("AI kept failing — saved what was done; run again later"); }
          await sleep(45000); b -= BATCH; continue;
        }
        await sleep(Number(process.env.MAP_SLEEP_MS ?? 6000));
      }
      console.log(`${exam} · ${unit.id} (${unit.name_ta}): ${gTopics.filter((t) => map[t.id]?.length).length}/${gTopics.length} topics linked`);
      await save();
    }
  }
  for (const ids of Object.values(map)) ids.sort((a, b) => (chapters.find((c) => c.id === a)?.std ?? 0) - (chapters.find((c) => c.id === b)?.std ?? 0));
  out.exams[exam] = map;
  await save();
  console.log(`${exam}: ${Object.keys(map).length}/${topics.filter((t) => exUnits.some((u) => u.id === t.unit_id)).length} topics have lessons`);
}
await save();
await admin.from("job_runs").insert({ job: "map_topics", ok: true, detail: { calls, exams: Object.fromEntries(Object.entries(out.exams).map(([k, v]) => [k, Object.keys(v).length])), lessons: Object.keys(out.lessons).length } });
console.log(`DONE · ${calls} AI calls · ${Object.keys(out.lessons).length} lessons linked`);
