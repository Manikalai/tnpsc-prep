// Question generation from the Tamil textbooks (RAG), validation, de-duplication and storage.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJSON, tamilRatio } from "./ai";
import { findPassages } from "./retrieve";

export type Unit = {
  id: string;
  exam_code: string;
  part_id: string;
  name_ta: string;
  questions: number;
  standard: string;
  subject: string;
  source_subjects: string[];
};
export type Chunk = { id: number; book: string; std: number; subject: string; page_from: number | null; content: string };

export const QuestionZ = z.object({
  stem: z.string().min(8),
  options: z.array(z.string().min(1)).length(4),
  answer_index: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
  source: z.number().int().optional(), // index into the passages we sent
  style: z.string().optional(),
  difficulty: z.string().optional(),
});
export type GenQuestion = z.infer<typeof QuestionZ>;

export const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[.?!,:;"'()\-–]/g, "").trim().toLowerCase();
export const qHash = (stem: string, options: string[]) =>
  createHash("sha1").update(norm(stem) + "|" + options.map(norm).sort().join("|")).digest("hex");

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** AI questions must have every part: 4 choices, answer, explanation, a textbook passage, a difficulty. */
export function validateStrict(raw: unknown, passageCount: number): (GenQuestion & { source: number; difficulty: string }) | null {
  const q = validate(raw);
  if (!q) return null;
  if (!q.explanation || q.explanation.trim().length < 10) return null;
  if (typeof q.source !== "number" || q.source < 0 || q.source >= passageCount) return null;
  const difficulty = (q.difficulty ?? "").toLowerCase();
  return { ...q, source: q.source, difficulty: (DIFFICULTIES as readonly string[]).includes(difficulty) ? difficulty : "medium" };
}

/** "10ஆம் வகுப்பு சமூக அறிவியல், பாடம் 5: இந்திய அரசியலமைப்பு, பக். 145" */
export function textbookRef(c: { book: string; page_from: number | null }, ch?: { chapter_no: number; title_ta: string } | null) {
  return `${c.book}${ch ? `, பாடம் ${ch.chapter_no}: ${ch.title_ta}` : ""}${c.page_from ? `, பக். ${c.page_from}` : ""}`;
}

/** Chapter (number, title) for each passage id, so references can name the chapter. */
export async function chaptersForChunks(admin: SupabaseClient, chunkIds: number[]) {
  const out = new Map<number, { id: number; chapter_no: number; title_ta: string }>();
  if (!chunkIds.length) return out;
  const { data } = await admin.from("textbook_chunks").select("id,chapter_id,chapters(id,chapter_no,title_ta)").in("id", chunkIds);
  for (const r of (data ?? []) as unknown as { id: number; chapters: { id: number; chapter_no: number; title_ta: string } | null }[]) {
    if (r.chapters) out.set(r.id, r.chapters);
  }
  return out;
}

export function validate(raw: unknown, opts: { requireTamil?: boolean } = {}): GenQuestion | null {
  const r = QuestionZ.safeParse(raw);
  if (!r.success) return null;
  const q = r.data;
  const distinct = new Set(q.options.map(norm));
  if (distinct.size !== 4) return null;
  if (opts.requireTamil !== false && tamilRatio(q.stem) < 0.5) return null;
  return q;
}

export const STYLE_GUIDE = `TNPSC question styles to mix:
- direct: a plain question with four options.
- statement: "கீழ்க்கண்ட கூற்றுகளில் சரியானது எது?" with statements I, II, III and options like "I மட்டும்", "I மற்றும் II", ...
- match: "பொருத்துக" with list A (a,b,c,d) and list B (1,2,3,4); options are codes like "a-2, b-1, c-4, d-3".
- assertion: "கூற்று (A): ... காரணம் (R): ..." with the four standard TNPSC options.
- odd: "பொருந்தாத ஒன்றைத் தேர்ந்தெடு".
- wrong: "தவறான இணையைத் தேர்ந்தெடு" / "தவறான கூற்று எது?".`;

export function glossaryText(rows: { en: string; ta: string }[]) {
  return rows.map((g) => `${g.en} = ${g.ta}`).join("; ");
}

export async function retrieveForUnit(
  admin: SupabaseClient,
  unit: Unit,
  focus: string,
  maxStd: number,
  count = 6
): Promise<Chunk[]> {
  try {
    return (await findPassages(admin, { text: `${unit.name_ta} – ${focus}`, subjects: unit.source_subjects, unitSubject: unit.subject, maxStd, count })) as Chunk[];
  } catch {
    return [];
  }
}

export async function loadGlossary(admin: SupabaseClient) {
  const { data } = await admin.from("glossary").select("en,ta").limit(400);
  return (data ?? []) as { en: string; ta: string }[];
}

/** Generate `n` new questions for a unit (optionally a topic) and store them. Returns inserted ids. */
export async function generateForUnit(
  admin: SupabaseClient,
  unit: Unit,
  opts: { n: number; topic?: { id: string; name_ta: string }; maxStd: number; topics?: { id: string; name_ta: string }[]; timeoutMs?: number }
): Promise<{ ids: string[]; provider?: string; grounded: boolean; errors: string[] }> {
  const pool = opts.topics ?? [];
  const topic = opts.topic ?? (pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined);
  const focus = topic?.name_ta ?? unit.name_ta;
  const chunks = await retrieveForUnit(admin, unit, focus, opts.maxStd);
  const grounded = chunks.length > 0;
  // Rule: questions come only from textbook text. No passages → no AI questions.
  if (!grounded) return { ids: [], grounded, errors: ["பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை — பாடநூல் உரை இல்லாமல் வினாக்கள் உருவாக்கப்படாது."] };
  const glossary = await loadGlossary(admin);
  const level = unit.standard === "SSLC" ? "SSLC (10th standard)" : "degree standard";

  const passages = chunks
    .map((c, i) => `[${i}] (${c.book}${c.page_from ? `, பக்கம் ${c.page_from}` : ""})\n${c.content}`)
    .join("\n\n");

  const system = `You write TNPSC (Tamil Nadu Public Service Commission) exam questions for Tamil-medium candidates.
Write EVERYTHING in correct, formal Tamil exactly as Samacheer Kalvi textbooks and TNPSC question papers do.
Use these official Tamil terms when they apply: ${glossaryText(glossary)}.
Rules:
- Every fact must come from the numbered textbook passages. Never use your own knowledge. Every question MUST have "source" = the passage number it comes from.
- Exactly 4 options, one correct, all plausible, no "மேற்கண்ட அனைத்தும்" unless the passage supports it.
- Do not invent grammar rules, verse lines or quotations. Quote Thirukkural / literature only if the exact text is in a passage.
- Level: ${level}.
- explanation (required): 1–3 Tamil sentences saying why the answer is right, from the passage.
- difficulty (required): easy (direct one-fact), medium, or hard (statement / assertion–reason / match on finer details).
${STYLE_GUIDE}
Return JSON: {"questions":[{"stem":"","options":["","","",""],"answer_index":0,"explanation":"","source":0,"style":"direct","difficulty":"easy|medium|hard"}]}`;

  const user = `அலகு: ${unit.name_ta}
தலைப்பு: ${focus}
${opts.n} வினாக்கள் உருவாக்கவும் (பல்வேறு வடிவங்கள் கலந்து).
\nபாடநூல் பகுதிகள்:\n${passages}`;

  const errors: string[] = [];
  let provider: string | undefined;
  let raw: unknown[] = [];
  try {
    const r = await generateJSON<{ questions: unknown[] }>({ system, user, temperature: 0.7, timeoutMs: opts.timeoutMs, maxTokens: opts.timeoutMs ? 4096 : 8192 });
    provider = r.provider;
    raw = Array.isArray(r.data?.questions) ? r.data.questions : [];
  } catch (e) {
    const detail = e && typeof e === "object" && "attempts" in e ? ` — ${(e as { attempts: string[] }).attempts.slice(0, 2).join(" | ").slice(0, 300)}` : "";
    errors.push((e instanceof Error ? e.message : String(e)) + detail);
    return { ids: [], grounded, errors };
  }

  const rows = [];
  const chMap = await chaptersForChunks(admin, chunks.map((c) => c.id));
  for (const item of raw) {
    const q = validateStrict(item, chunks.length);
    if (!q) {
      errors.push("question without all parts (4 choices, answer, explanation, textbook source, difficulty) skipped");
      continue;
    }
    const c = chunks[q.source];
    const ch = chMap.get(c.id);
    rows.push({
      exam_code: unit.exam_code,
      unit_id: unit.id,
      topic_id: topic?.id ?? null,
      stem: q.stem.trim(),
      options: q.options.map((o) => o.trim()),
      answer_index: q.answer_index,
      explanation: q.explanation,
      source_ref: textbookRef(c, ch),
      chunk_id: c.id,
      chapter_id: ch?.id ?? null,
      origin: "ai",
      style: q.style ?? null,
      difficulty: q.difficulty,
      hash: qHash(q.stem, q.options),
    });
  }
  if (!rows.length) return { ids: [], provider, grounded, errors };
  const { data, error } = await admin
    .from("questions")
    .upsert(rows, { onConflict: "hash", ignoreDuplicates: true })
    .select("id");
  if (error) errors.push(error.message);
  return { ids: (data ?? []).map((r: { id: string }) => r.id), provider, grounded, errors };
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
