// Answer-key audit: finds questions whose marked answer may be wrong, and holds them back until reviewed.
// 1) Rule check (no AI): in "பிரித்து எழுதுக" answers, a split part can't end in a hard consonant (க் ச் ட் த் ப் ற்);
//    e.g. "செம்மைத் + தமிழ்" keeps the joining த் — a classic wrong split.
// 2) Blind check: another AI answers each question WITHOUT seeing the key (10 per request).
// 3) Judge: only where they disagree, an AI reads the question again next to its lesson text (if any) and decides.
// A question is flagged (hidden from quizzes, listed on the admin page with the reason) only when the rule check
// fails or the judge also says the key is wrong. Progress is kept in Storage meta/audit.json, so the job resumes
// day after day within the free AI limits.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { generateJSON } from "../lib/ai";
import { chapterText } from "../lib/chapters";

const admin = supabaseAdmin();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const L = ["அ", "ஆ", "இ", "ஈ"];
const MAX = Number(process.env.AUDIT_MAX ?? 3000);
const MINUTES = Number(process.env.AUDIT_MINUTES ?? 170);
const until = Date.now() + MINUTES * 60_000;
const ORIGINS = (process.env.AUDIT_ORIGINS || "ai,pyq").split(",").map((s) => s.trim());

type Q = { id: string; stem: string; options: string[]; answer_index: number; explanation: string | null; chapter_id: number | null; origin: string; style: string | null };
type State = { done: Record<string, "ok" | "flag">; made: string };

const state: State = await admin.storage.from("meta").download("audit.json")
  .then(async (r) => (r.data ? (JSON.parse(await r.data.text()) as State) : { done: {}, made: "" }))
  .catch(() => ({ done: {}, made: "" }));
async function save() {
  state.made = new Date().toISOString();
  const body = new Blob([JSON.stringify(state)], { type: "application/json" });
  let up = await admin.storage.from("meta").upload("audit.json", body, { upsert: true, contentType: "application/json" });
  if (up.error) { await admin.storage.createBucket("meta", { public: true }); up = await admin.storage.from("meta").upload("audit.json", body, { upsert: true, contentType: "application/json" }); }
  if (up.error) console.log("save failed:", up.error.message);
}

// all active questions of the chosen origins not audited yet
const all: Q[] = [];
for (let f = 0; ; f += 1000) {
  const { data, error } = await admin.from("questions").select("id,stem,options,answer_index,explanation,chapter_id,origin,style")
    .eq("status", "active").in("origin", ORIGINS).order("created_at").range(f, f + 999);
  if (error) throw error;
  all.push(...((data ?? []) as Q[]));
  if (!data || data.length < 1000) break;
}
const todo = all.filter((q) => !state.done[q.id] && Array.isArray(q.options) && q.options.length === 4).slice(0, MAX);
console.log(`active ${all.length} · already audited ${Object.keys(state.done).length} · this run ${todo.length}`);

let flagged = 0, okCount = 0, calls = 0, fails = 0;
const flagList: string[] = [];

async function flag(q: Q, note: string) {
  await admin.from("questions").update({ status: "flagged", verify_note: note.slice(0, 300), verified_at: new Date().toISOString() }).eq("id", q.id);
  state.done[q.id] = "flag"; flagged++;
  flagList.push(`${q.stem.slice(0, 70)} → ${note.slice(0, 120)}`);
}

// ---------- 1) rule check ----------
const HARD_END = /[கசடதபற]்$/;
function splitProblem(q: Q): string | null {
  if (!/பிரித்(து|தெழுது|த)/.test(q.stem)) return null;
  const ans = q.options[q.answer_index] ?? "";
  if (!ans.includes("+")) return null;
  const parts = ans.split("+").map((p) => p.trim()).filter(Boolean);
  for (const p of parts.slice(0, -1)) if (HARD_END.test(p)) return `பிரித்தெழுதும் விடை "${ans}" — "${p}" வல்லின மெய்யில் முடிகிறது (புணர்ச்சியில் வந்த எழுத்து பிரிக்கப்படவில்லை)`;
  return null;
}

const rest: Q[] = [];
for (const q of todo) {
  const p = splitProblem(q);
  if (p) await flag(q, p); else rest.push(q);
}
console.log(`rule check: ${flagged} flagged`);

// ---------- 2) blind answers, 3) judge ----------
const lessonCache = new Map<number, string>();
async function lesson(id: number) {
  if (!lessonCache.has(id)) lessonCache.set(id, (await chapterText(admin, id, 14000)).text);
  return lessonCache.get(id)!;
}

async function ai<T>(o: Parameters<typeof generateJSON>[0]): Promise<T | null> {
  for (;;) {
    if (Date.now() > until) return null;
    try { const { data } = await generateJSON<T>(o); calls++; fails = 0; return data; }
    catch (e) {
      fails++;
      console.log(`AI failed (${String(e).slice(0, 120)})`);
      if (fails >= 6) return null;
      await sleep(45000);
    }
  }
}

let stop = false;
for (let b = 0; b < rest.length && !stop; b += 10) {
  const batch = rest.slice(b, b + 10);
  const blind = await ai<{ answers: { id: number; answer: number; sure: boolean }[] }>({
    system: `You are a TNPSC (Tamil Nadu) exam expert, very strong in Tamil grammar (இலக்கணம், புணர்ச்சி, பிரித்தெழுதுதல்), Tamil literature, Indian history, polity, geography, science and maths. Answer each multiple-choice question yourself. Think carefully; use standard Tamil Nadu school textbook knowledge. Return JSON {"answers":[{"id":0,"answer":<0-3 index of the correct option>,"sure":true|false}]} — one entry per question.`,
    user: batch.map((q, i) => `[${i}] ${q.stem}\n${q.options.map((o, k) => `(${k}) ${o}`).join("  ")}`).join("\n\n"),
    temperature: 0,
    maxTokens: 2500,
  });
  if (!blind) { stop = true; break; }
  for (const [i, q] of batch.entries()) {
    const a = (blind.answers ?? []).find((x) => Number(x.id) === i);
    if (!a || Number(a.answer) === q.answer_index || !a.sure) { state.done[q.id] = "ok"; okCount++; continue; }
    // disagreement: judge it carefully, with the lesson text when the question came from a lesson
    const text = q.chapter_id ? await lesson(q.chapter_id) : "";
    const v = await ai<{ key_correct: boolean; correct_index: number | null; reason: string }>({
      system: `You check one TNPSC exam question whose answer key may be wrong. ${text ? "Use the textbook lesson given as the main authority, plus standard Tamil grammar/knowledge." : "Use standard Tamil Nadu textbook knowledge and Tamil grammar."} Decide whether the MARKED answer is correct. Say key_correct:false only if you are confident it is wrong (then give correct_index), or if the question is unclear/has two correct options (correct_index null). Return JSON {"key_correct":true|false,"correct_index":<0-3 or null>,"reason":"one short Tamil sentence"}`,
      user: `${text ? `=== பாடம் ===\n${text}\n\n` : ""}=== வினா ===\n${q.stem}\n${q.options.map((o, k) => `(${L[k]}) ${o}`).join("  ")}\nகுறிக்கப்பட்ட விடை: (${L[q.answer_index]}) ${q.options[q.answer_index]}${q.explanation ? `\nவிளக்கம்: ${q.explanation}` : ""}`,
      temperature: 0,
      maxTokens: 600,
    });
    if (!v) { stop = true; break; }
    if (v.key_correct === false) {
      const ci = typeof v.correct_index === "number" && v.correct_index >= 0 && v.correct_index < 4 ? v.correct_index : null;
      await flag(q, `${ci != null ? `சரியான விடை (${L[ci]}) ${q.options[ci]} ஆக இருக்கலாம். ` : "இரண்டு விடைகள் / தெளிவில்லை. "}${v.reason ?? ""}`);
    } else { state.done[q.id] = "ok"; okCount++; }
    await sleep(2000);
  }
  if ((b / 10) % 5 === 4) await save();
  await sleep(Number(process.env.AUDIT_SLEEP_MS ?? 4000));
}
await save();
const left = all.filter((q) => !state.done[q.id]).length;
await admin.from("job_runs").insert({ job: "audit_questions", ok: true, detail: { checked: okCount + flagged, flagged, ok: okCount, calls, left, sample: flagList.slice(0, 30) } });
console.log(`DONE · checked ${okCount + flagged} · flagged ${flagged} · ${calls} AI calls · ${left} still to check`);
for (const f of flagList) console.log("FLAG " + f);
