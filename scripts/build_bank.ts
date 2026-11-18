// Nightly question-bank builder. Tops up every unit to 3× its share of the paper, starting with the
// exam whose date is nearest. Usage: npx tsx scripts/build_bank.ts [maxCalls]
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { generateForUnit, qHash, type Unit } from "../lib/questions";
import { maxStdFor } from "../lib/exam";
import { drill, APT_TYPES } from "../lib/aptitude";

const admin = supabaseAdmin();
const maxCalls = Number(process.argv[2] ?? process.env.BANK_MAX_CALLS ?? 120);
const order = (process.env.BANK_EXAMS ?? "G4,G2,G1").split(",");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { data: units } = await admin.from("units").select("*");
const { data: counts } = await admin.from("bank_counts").select("*");
const have = new Map<string, number>();
for (const c of counts ?? []) if (c.unit_id) have.set(c.unit_id, (have.get(c.unit_id) ?? 0) + c.n);

let calls = 0;
let failStreak = 0;
let added = 0;
const log: string[] = [];

// 1) aptitude & reasoning: computed questions (always correct)
for (const u of (units ?? []).filter((x) => x.subject === "aptitude" || x.subject === "reasoning")) {
  const need = u.questions * 4 - (have.get(u.id) ?? 0);
  if (need <= 0) continue;
  const keys = APT_TYPES.filter((t) => t.unit === u.subject).map((t) => t.key);
  const rows = drill(keys, need).map((q) => ({
    exam_code: u.exam_code, unit_id: u.id, stem: q.stem, options: q.options, answer_index: q.answer_index,
    explanation: q.explanation, origin: "aptitude", source_ref: "கணக்கிடப்பட்ட வினா", hash: qHash(q.stem, q.options),
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
    log.push(`${t.u.id}: +${r.ids.length} via ${r.provider ?? "-"}${r.grounded ? "" : " (no textbook)"}${r.errors.length ? " ! " + r.errors[0].slice(0, 120) : ""}`);
    console.log(log.at(-1));
    if (r.errors.some((e) => /all AI providers failed|எல்லா AI/.test(e))) {
      failStreak++;
      if (failStreak >= 4) break outer; // daily limits really reached – continue tomorrow
      await sleep(45000); // busy right now – wait and carry on
      continue;
    }
    failStreak = 0;
    await sleep(Number(process.env.BANK_SLEEP_MS ?? 7000)); // stay under free-tier per-minute limits
  }
  if (!progressed) break;
}

await admin.from("job_runs").insert({ job: "build_bank", ok: true, detail: { added, calls, log: log.slice(-60) } });
console.log(`done: ${added} questions in ${calls} AI calls`);
