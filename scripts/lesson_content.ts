// Prepares EVERYTHING for every lesson, Group 4 classes (6–10) first:
//   easy notes (all parts) · book-back questions with answers · key points & summary · dates/persons/facts
//   · revision Q&A · 10 MCQs.  Only what is missing is made, so it can run again and again.
// Stops cleanly when the time budget is used or the AI providers keep failing (daily limits reached).
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { generateBookBack } from "../lib/bookback";
import { cleanDone, generateChapterMCQs, generateChapterNote, generateCleanPart, NOTE_KINDS, type Chapter, type Clean } from "../lib/chapters";

const admin = supabaseAdmin();
const budgetMs = Number(process.env.LESSON_MINUTES || 320) * 60e3;
const maxStd = Number(process.env.LESSON_MAX_STD || 12);
const only = (process.env.LESSON_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean); // e.g. "bookback,clean"
const want = (k: string) => !only.length || only.includes(k);
const t0 = Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const timeLeft = () => Date.now() - t0 < budgetMs;

let ok = 0, failed = 0, failStreak = 0;
const tally: Record<string, number> = {};

async function step(name: string, ch: Chapter, f: () => Promise<unknown>) {
  if (!timeLeft() || failStreak >= 6) return false;
  try {
    await f();
    ok++; failStreak = 0; tally[name] = (tally[name] ?? 0) + 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    if (/all AI providers failed|providers failed/i.test(String(e instanceof Error ? e.message : e))) failStreak++; // only "AI unavailable" stops the run
    console.log(`  ✗ ${name}: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
  }
  await sleep(Number(process.env.LESSON_SLEEP_MS || 4000));
  return true;
}

const { data: chs } = await admin.from("chapters").select("*").lte("std", maxStd).order("std").order("term").order("book").order("chapter_no").limit(5000);
const { data: notes } = await admin.from("chapter_notes").select("chapter_id,kind,content").limit(20000);
const have = new Set((notes ?? []).map((n) => `${n.chapter_id}:${n.kind}`));
const clean = new Map((notes ?? []).filter((n) => n.kind === "clean").map((n) => [n.chapter_id as number, n.content as Clean]));
const { data: mcq } = await admin.from("questions").select("chapter_id").not("chapter_id", "is", null).eq("origin", "ai").limit(100000);
const mcqCount = new Map<number, number>();
for (const q of mcq ?? []) mcqCount.set(q.chapter_id, (mcqCount.get(q.chapter_id) ?? 0) + 1);
const { data: withText } = await admin.from("textbook_chunks").select("chapter_id").not("chapter_id", "is", null).limit(100000);
const hasText = new Set((withText ?? []).map((r) => r.chapter_id));

const list = ((chs ?? []) as Chapter[]).filter((c) => hasText.has(c.id));
console.log(`${list.length} lessons with text (std ≤ ${maxStd})`);

for (const ch of list) {
  if (!timeLeft() || failStreak >= 6) break;
  const todo: [string, () => Promise<unknown>][] = [];
  const c = clean.get(ch.id);
  if (want("bookback") && !have.has(`${ch.id}:bookback`)) todo.push(["bookback", () => generateBookBack(admin, ch)]);
  if (want("clean") && !cleanDone(c)) {
    todo.push(["clean", async () => {
      let total = c?.total ?? 1;
      for (let i = 0; i < total; i++) {
        if (c?.parts[i]?.length) continue;
        total = (await generateCleanPart(admin, ch, i)).total;
        await sleep(2000);
      }
    }]);
  }
  for (const k of NOTE_KINDS) if (want(k) && !have.has(`${ch.id}:${k}`)) todo.push([k, () => generateChapterNote(admin, ch, k)]);
  if (want("mcq") && (mcqCount.get(ch.id) ?? 0) < 10) todo.push(["mcq", () => generateChapterMCQs(admin, ch, 10)]);
  if (!todo.length) continue;
  console.log(`\n== ${ch.book} · பாடம் ${ch.chapter_no}: ${ch.title_ta}`);
  for (const [name, f] of todo) if (!(await step(name, ch, f))) break;
}

const stopped = failStreak >= 6 ? "AI providers kept failing (daily limits) — run again later" : timeLeft() ? "all lessons done" : "time budget used — run again to continue";
console.log(`\nDONE: ${ok} made, ${failed} failed · ${JSON.stringify(tally)} · ${stopped}`);
await admin.from("job_runs").insert({ job: "lesson_content", ok: true, detail: { ok, failed, tally, stopped } });
