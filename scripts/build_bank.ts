// Nightly question-bank builder. Tops up every unit to 3× its share of the paper, starting with the
// exam whose date is nearest. Usage: npx tsx scripts/build_bank.ts [maxCalls]
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { generateForUnit, qHash, type Unit } from "../lib/questions";
import { maxStdFor } from "../lib/exam";
import { drill, APT_TYPES } from "../lib/aptitude";
import { verifyPending } from "../lib/verify";
import { generateBookBack } from "../lib/bookback";
import { classifyChapters, cleanDone, generateChapterMCQs, generateChapterNote, generateCleanPart, NOTE_KINDS, type Chapter, type Clean } from "../lib/chapters";

const admin = supabaseAdmin();
const maxCalls = Number(process.argv[2] || process.env.BANK_MAX_CALLS || 120);
const order = (process.env.BANK_EXAMS || "G4,G2,G1").split(",");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { data: units } = await admin.from("units").select("*");
const { data: counts } = await admin.from("bank_counts").select("*");
const have = new Map<string, number>();
for (const c of counts ?? []) if (c.unit_id) have.set(c.unit_id, (have.get(c.unit_id) ?? 0) + c.n);

let calls = 0;
let failStreak = 0;
let added = 0;
const log: string[] = [];

// 0) rule: every AI question must come from the textbook. Once books are loaded, retire the old ones without a source.
{
  const { count: chunks } = await admin.from("textbook_chunks").select("*", { count: "exact", head: true });
  if ((chunks ?? 0) >= 3000) {
    const { data: gone } = await admin.from("questions").update({ status: "retired" }).eq("origin", "ai").is("chunk_id", null).is("chapter_id", null).eq("status", "active").select("id");
    if (gone?.length) log.push(`retired ${gone.length} AI questions without a textbook source`);
  }
}

// 1) aptitude & reasoning: computed questions (always correct)
for (const u of (units ?? []).filter((x) => x.subject === "aptitude" || x.subject === "reasoning")) {
  const need = u.questions * 4 - (have.get(u.id) ?? 0);
  if (need <= 0) continue;
  const keys = APT_TYPES.filter((t) => t.unit === u.subject).map((t) => t.key);
  const rows = drill(keys, need).map((q) => ({
    exam_code: u.exam_code, unit_id: u.id, stem: q.stem, options: q.options, answer_index: q.answer_index,
    explanation: q.explanation, origin: "aptitude", difficulty: "medium", source_ref: "கணக்கிடப்பட்ட வினா (திறனறிவு)", hash: qHash(q.stem, q.options),
  }));
  const { data } = await admin.from("questions").upsert(rows, { onConflict: "hash", ignoreDuplicates: true }).select("id");
  added += data?.length ?? 0;
  log.push(`${u.id}: +${data?.length ?? 0} (computed)`);
}

// 2) everything else: AI from textbooks, most-needed units first
const targets = (units ?? [])
  .filter((u) => u.subject !== "aptitude" && u.subject !== "reasoning")
  .map((u) => ({ u, gap: u.questions * 3 - (have.get(u.id) ?? 0) }))
  .filter((x) => x.gap > 0)
  .sort((a, b) => order.indexOf(a.u.exam_code) - order.indexOf(b.u.exam_code) || b.gap / b.u.questions - a.gap / a.u.questions);

const topicsByUnit = new Map<string, { id: string; name_ta: string }[]>();
const { data: topics } = await admin.from("topics").select("id,unit_id,name_ta");
for (const t of topics ?? []) topicsByUnit.set(t.unit_id, [...(topicsByUnit.get(t.unit_id) ?? []), t]);

outer: while (calls < maxCalls) {
  let progressed = false;
  for (const t of targets) {
    if (calls >= maxCalls) break outer;
    if (t.gap <= 0) continue;
    calls++;
    const r = await generateForUnit(admin, t.u as Unit, { n: 10, topics: topicsByUnit.get(t.u.id) ?? [], maxStd: maxStdFor(t.u.exam_code) });
    t.gap -= r.ids.length;
    added += r.ids.length;
    if (r.ids.length) progressed = true;
    if (!r.grounded) { log.push(`${t.u.id}: skipped — no textbook text for this unit yet`); console.log(log.at(-1)); continue; }
    log.push(`${t.u.id}: +${r.ids.length} via ${r.provider ?? "-"}${r.errors.length ? " ! " + r.errors[0].slice(0, 120) : ""}`);
    console.log(log.at(-1));
    if (r.errors.some((e) => /all AI providers failed|எல்லா AI/.test(e))) {
      failStreak++;
      if (failStreak >= 4) break outer; // daily limits really reached – continue tomorrow
      await sleep(45000); // busy right now – wait and carry on
      continue;
    }
    failStreak = 0;
    await sleep(Number(process.env.BANK_SLEEP_MS || 7000)); // stay under free-tier per-minute limits
  }
  if (!progressed) break;
}

// 3a) label chapter sections (History / Geography / …) for the quiz builder
try {
  const labelled = await classifyChapters(admin);
  if (labelled) log.push(`chapter sections labelled: ${labelled}`);
} catch {
  /* column missing until migration 0005 is run */
}

// 3) chapters: summary, facts, revision questions and 10 MCQs per chapter (Group 4 classes first)
const chapterBudget = Number(process.env.BANK_CHAPTER_CALLS || 60);
let chapterCalls = 0;
{
  const { data: chs } = await admin.from("chapters").select("*").order("std").order("term").order("chapter_no").limit(3000);
  const { data: done } = await admin.from("chapter_notes").select("chapter_id,kind");
  const have = new Set((done ?? []).map((d) => `${d.chapter_id}:${d.kind}`));
  const { data: cleanRows } = await admin.from("chapter_notes").select("chapter_id,content").eq("kind", "clean");
  const clean = new Map((cleanRows ?? []).map((r) => [r.chapter_id as number, r.content as Clean]));
  const { data: mcq } = await admin.from("questions").select("chapter_id").not("chapter_id", "is", null).limit(50000);
  const mcqCount = new Map<number, number>();
  for (const q of mcq ?? []) mcqCount.set(q.chapter_id, (mcqCount.get(q.chapter_id) ?? 0) + 1);
  outer2: for (const ch of (chs ?? []) as Chapter[]) {
    if (process.uptime() > 40 * 60) break; // leave time for the fact-check before the 60-minute limit
    // easy notes (lesson rewritten neatly), part by part
    const c = clean.get(ch.id);
    if (!cleanDone(c)) {
      let total = c?.total ?? 1;
      for (let i = 0; i < total; i++) {
        if (c?.parts[i]?.length) continue;
        if (chapterCalls >= chapterBudget || process.uptime() > 40 * 60) break outer2;
        chapterCalls++;
        try {
          total = (await generateCleanPart(admin, ch, i)).total;
          log.push(`chapter ${ch.id} clean ${i + 1}/${total}: ok`);
        } catch (e) {
          log.push(`chapter ${ch.id} clean ${i + 1}: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`);
          console.log(log.at(-1));
          break;
        }
        console.log(log.at(-1));
        await sleep(Number(process.env.BANK_SLEEP_MS || 7000));
      }
    }
    if (!have.has(`${ch.id}:bookback`) && chapterCalls < chapterBudget && process.uptime() < 40 * 60) {
      chapterCalls++;
      try {
        const bb = await generateBookBack(admin, ch);
        log.push(`chapter ${ch.id} bookback: ${bb.sections.reduce((n, s) => n + s.items.length, 0)} questions`);
      } catch (e) {
        log.push(`chapter ${ch.id} bookback: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`);
      }
      console.log(log.at(-1));
      await sleep(Number(process.env.BANK_SLEEP_MS || 7000));
    }
    for (const kind of NOTE_KINDS) {
      if (have.has(`${ch.id}:${kind}`)) continue;
      if (chapterCalls >= chapterBudget) break outer2;
      chapterCalls++;
      try {
        await generateChapterNote(admin, ch, kind);
        log.push(`chapter ${ch.id} ${kind}: ok`);
      } catch (e) {
        log.push(`chapter ${ch.id} ${kind}: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`);
      }
      console.log(log.at(-1));
      await sleep(Number(process.env.BANK_SLEEP_MS || 7000));
    }
    if ((mcqCount.get(ch.id) ?? 0) < 10 && chapterCalls < chapterBudget) {
      chapterCalls++;
      try {
        const ids = await generateChapterMCQs(admin, ch, 10);
        added += ids.length;
        log.push(`chapter ${ch.id} mcq: +${ids.length}`);
      } catch (e) {
        log.push(`chapter ${ch.id} mcq: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`);
      }
      console.log(log.at(-1));
      await sleep(Number(process.env.BANK_SLEEP_MS || 7000));
    }
  }
}

// 4) fact-check new AI questions against their textbook passage (retires the ones the passage doesn't support)
const verify = await verifyPending(admin, Number(process.env.VERIFY_MAX || 400), Number(process.env.BANK_SLEEP_MS || 6000), (s) => { log.push(s); console.log(s); });
log.push(`fact-check: ${verify.ok} ok, ${verify.failed} retired`);
console.log(log.at(-1));

await admin.from("job_runs").insert({ job: "build_bank", ok: true, detail: { added, calls, chapterCalls, verified: verify.ok, retired: verify.failed, log: log.slice(-60) } });
console.log(`done: ${added} questions in ${calls} unit calls + ${chapterCalls} chapter calls`);
