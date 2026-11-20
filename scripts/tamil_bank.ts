// Builds the பொதுத் தமிழ் bank from every Tamil textbook lesson (6th–10th first, then 11th–12th):
// checked MCQs tagged gt:<topic> + author/book facts. Lessons already done are skipped, so it can be re-run.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { buildTamilLesson } from "../lib/tamil";
import type { Chapter } from "../lib/chapters";

const admin = supabaseAdmin();
const deadline = Date.now() + Number(process.env.TAMIL_MINUTES ?? 150) * 60e3;
const maxStd = Number(process.env.TAMIL_MAX_STD ?? 12);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { data: chs } = await admin.from("chapters").select("*").eq("subject", "tamil").lte("std", maxStd).order("std").order("term").order("chapter_no").limit(1000);
const { data: done } = await admin.from("chapter_notes").select("chapter_id").eq("kind", "tamil").limit(5000);
const doneSet = new Set((done ?? []).map((d) => d.chapter_id));
const todo: Chapter[] = [];
for (const c of (chs ?? []) as Chapter[]) {
  if (doneSet.has(c.id)) continue;
  const { count } = await admin.from("textbook_chunks").select("id", { count: "exact", head: true }).eq("chapter_id", c.id);
  if (count) todo.push(c);
}
console.log(`${(chs ?? []).length} Tamil lessons · ${doneSet.size} done · ${todo.length} to do`);

let made = 0, nool = 0, fails = 0, lessons = 0;
for (const ch of todo) {
  if (Date.now() > deadline - 3 * 60e3) { console.log("time budget used; run again to continue"); break; }
  try {
    const r = await buildTamilLesson(admin, ch);
    made += r.questions; nool += r.nool; lessons++; fails = 0;
    console.log(`✓ ${ch.book} · பாடம் ${ch.chapter_no}: ${r.questions} questions (${r.dropped} dropped by the check), ${r.nool} நூல்–ஆசிரியர்`);
  } catch (e) {
    fails++;
    console.log(`✗ ${ch.book} · பாடம் ${ch.chapter_no}: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
    if (fails >= 5) { console.log("AI kept failing (daily limits); run again later"); break; }
    await sleep(20000);
  }
  await sleep(Number(process.env.TAMIL_SLEEP_MS ?? 2500));
}
console.log(`DONE: ${lessons} lessons, ${made} questions, ${nool} நூல்–ஆசிரியர் pairs`);
await admin.from("job_runs").insert({ job: "tamil_bank", ok: lessons > 0 || !todo.length, detail: { lessons, made, nool, left: todo.length - lessons } });
