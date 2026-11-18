// Question generation from the Tamil textbooks (RAG), validation, de-duplication and storage.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed, generateJSON, tamilRatio } from "./ai";

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
    const [vec] = await embed([`${unit.name_ta} – ${focus}`], "RETRIEVAL_QUERY");
    const { data, error } = await admin.rpc("match_chunks", {
      query_embedding: vec as unknown as string,
      match_count: count * 3,
      subjects: unit.source_subjects.length ? unit.source_subjects : null,
      max_std: maxStd,
    });
    if (error) throw error;
    const rows = (data ?? []) as Chunk[];
    // keep variety: shuffle the top results and take `count`
    return rows.sort(() => Math.random() - 0.5).slice(0, count);
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
  opts: { n: number; topic?: { id: string; name_ta: string }; maxStd: number; topics?: { id: string; name_ta: string }[] }
): Promise<{ ids: string[]; provider?: string; grounded: boolean; errors: string[] }> {
  const pool = opts.topics ?? [];
  const topic = opts.topic ?? (pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined);
  const focus = topic?.name_ta ?? unit.name_ta;
  const chunks = await retrieveForUnit(admin, unit, focus, opts.maxStd);
  const glossary = await loadGlossary(admin);
  const grounded = chunks.length > 0;
  const level = unit.standard === "SSLC" ? "SSLC (10th standard)" : "degree standard";

  const passages = chunks
    .map((c, i) => `[${i}] (${c.book}${c.page_from ? `, பக்கம் ${c.page_from}` : ""})\n${c.content}`)
    .join("\n\n");

  const system = `You write TNPSC (Tamil Nadu Public Service Commission) exam questions for Tamil-medium candidates.
Write EVERYTHING in correct, formal Tamil exactly as Samacheer Kalvi textbooks and TNPSC question papers do.
Use these official Tamil terms when they apply: ${glossaryText(glossary)}.
Rules:
- ${grounded ? "Every fact must come from the numbered passages. Do not use facts that are not in the passages. Put the passage number in \"source\"." : "No textbook passages are available, so only ask well-established textbook facts you are certain about."}
- Exactly 4 options, one correct, all plausible, no "மேற்கண்ட அனைத்தும்" unless the passage supports it.
- Do not invent grammar rules, verse lines or quotations. Quote Thirukkural / literature only if the exact text is in a passage.
- Level: ${level}.
- explanation: 1–3 Tamil sentences saying why the answer is right.
${STYLE_GUIDE}
Return JSON: {"questions":[{"stem":"","options":["","","",""],"answer_index":0,"explanation":"","source":0,"style":"direct","difficulty":"easy|medium|hard"}]}`;

  const user = `அலகு: ${unit.name_ta}
தலைப்பு: ${focus}
${opts.n} வினாக்கள் உருவாக்கவும் (பல்வேறு வடிவங்கள் கலந்து).
${grounded ? `\nபாடநூல் பகுதிகள்:\n${passages}` : ""}`;

  const errors: string[] = [];
  let provider: string | undefined;
  let raw: unknown[] = [];
  try {
    const r = await generateJSON<{ questions: unknown[] }>({ system, user, temperature: 0.7 });
    provider = r.provider;
    raw = Array.isArray(r.data?.questions) ? r.data.questions : [];
  } catch (e) {
    const detail = e && typeof e === "object" && "attempts" in e ? ` — ${(e as { attempts: string[] }).attempts.slice(0, 2).join(" | ").slice(0, 300)}` : "";
    errors.push((e instanceof Error ? e.message : String(e)) + detail);
    return { ids: [], grounded, errors };
  }

  const rows = [];
  for (const item of raw) {
    const q = validate(item);
    if (!q) {
      errors.push("invalid question skipped");
      continue;
    }
    const c = typeof q.source === "number" ? chunks[q.source] : undefined;
    rows.push({
      exam_code: unit.exam_code,
      unit_id: unit.id,
      topic_id: topic?.id ?? null,
      stem: q.stem.trim(),
      options: q.options.map((o) => o.trim()),
      answer_index: q.answer_index,
      explanation: q.explanation,
      source_ref: c ? `${c.book}${c.page_from ? `, பக். ${c.page_from}` : ""}` : null,
      chunk_id: c?.id ?? null,
      origin: "ai",
      style: q.style ?? null,
      difficulty: q.difficulty ?? "medium",
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
