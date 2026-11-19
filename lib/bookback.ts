// "புத்தக வினாக்கள்": the textbook's own end-of-lesson exercises (மதிப்பீடு), with answers and explanations
// worked out ONLY from the lesson text. Saved in chapter_notes (kind "bookback"); the 4-option multiple-choice
// ones also go into the question bank (origin "bookback") so they appear in quizzes and mock tests.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJSON } from "./ai";
import { chapterText, type Chapter } from "./chapters";
import { glossaryText, loadGlossary, qHash } from "./questions";

export type BookBackItem = { q: string; options?: string[]; answer: string; answer_index?: number | null; explanation: string; page?: number | null; verified?: boolean; check_note?: string };
export type BookBackSection = { type: "mcq" | "fill" | "truefalse" | "match" | "short" | "long" | "other"; title: string; items: BookBackItem[] };
export type BookBack = { sections: BookBackSection[]; found: boolean };

// Headings that start the exercises in Samacheer books
const MARKERS = ["மதிப்பீடு", "சரியான விடையைத் தேர்ந்தெடு", "சரியான விடையை தேர்ந்தெடு", "கோடிட்ட இடத்தை நிரப்பு", "பொருத்துக", "சரியா? தவறா", "சரியா தவறா", "குறுவினா", "சிறுவினா", "பெருவினா", "விடையளி", "பயிற்சி"];

/** Split the lesson into the teaching text and the exercise part (from the first exercise heading in the last half). */
export function splitExercises(text: string) {
  const half = Math.floor(text.length * 0.4);
  let at = -1;
  for (const m of MARKERS) {
    const i = text.indexOf(m, half);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return { lesson: text, exercises: "" };
  return { lesson: text.slice(0, at), exercises: text.slice(Math.max(0, at - 200)) };
}

export async function generateBookBack(admin: SupabaseClient, ch: Chapter, timeoutMs?: number): Promise<BookBack> {
  const { text: full, rows } = await chapterText(admin, ch.id, 120000);
  if (!full.trim()) throw new Error("இந்தப் பாடத்தின் உரை இன்னும் ஏற்றப்படவில்லை");
  const { lesson, exercises } = splitExercises(full);
  if (!exercises) {
    const empty = { sections: [], found: false };
    await admin.from("chapter_notes").upsert({ chapter_id: ch.id, kind: "bookback", content: empty });
    return empty;
  }
  const glossary = await loadGlossary(admin);
  const { data } = await generateJSON<{ sections: BookBackSection[] }>({
    system: `You prepare the TEXTBOOK'S OWN end-of-lesson exercises (book-back questions) of a Tamil Nadu Samacheer Kalvi lesson for TNPSC students, in correct formal Tamil.
The exercise text comes from a PDF and may have small spelling errors (missing ், split words) — write every question and option in correct Tamil, keeping its meaning exactly.
Copy EVERY exercise question in order, grouped by its section. Do not invent new questions. Skip activities, projects, "செயல்பாடு" and internet/ICT tasks.
For each question give the correct answer and a 1–3 sentence explanation, using ONLY the lesson text given. "page" = the [பக்கம் N] where the answer is explained, if you can tell.
Section types: mcq (choose the answer; give "options" as printed, 3 or 4, and "answer_index" 0-based), fill (fill in the blanks), truefalse (answer "சரி" or "தவறு", and the corrected statement if false), match (answer like "அ-3, ஆ-1, இ-4, ஈ-2"), short (2–3 line answer), long (5–8 line answer as short points), other.
Official Tamil terms: ${glossaryText(glossary)}.
Return JSON {"sections":[{"type":"mcq","title":"I. சரியான விடையைத் தேர்ந்தெடு","items":[{"q":"","options":["",""],"answer_index":0,"answer":"","explanation":"","page":0}]}]}`,
    user: `நூல்: ${ch.book}\nபாடம் ${ch.chapter_no}: ${ch.title_ta}\n\n=== பாடப் பகுதி (விடைகளுக்கு) ===\n${withPages(lesson, rows).slice(0, 60000)}\n\n=== புத்தகப் பயிற்சி வினாக்கள் ===\n${exercises.slice(0, 20000)}`,
    temperature: 0.2,
    maxTokens: 16384,
    timeoutMs,
  });
  const sections = (data.sections ?? [])
    .map((s) => ({
      type: (["mcq", "fill", "truefalse", "match", "short", "long"].includes(s.type) ? s.type : "other") as BookBackSection["type"],
      title: String(s.title ?? ""),
      items: (s.items ?? []).filter((it) => it && it.q && it.answer).map((it) => ({
        q: String(it.q).trim(), options: Array.isArray(it.options) ? it.options.map(String) : undefined, answer: String(it.answer).trim(),
        answer_index: typeof it.answer_index === "number" ? it.answer_index : null, explanation: String(it.explanation ?? "").trim(), page: Number(it.page) || null,
      })),
    }))
    .filter((s) => s.items.length);
  await checkAnswers(sections, withPages(lesson, rows).slice(0, 60000));
  const out: BookBack = { sections, found: true };
  await admin.from("chapter_notes").upsert({ chapter_id: ch.id, kind: "bookback", content: out });
  await saveToBank(admin, ch, sections);
  return out;
}

/** Strict second pass: every answer is checked against the lesson text. Unsupported ones are marked, never shown as certain. */
async function checkAnswers(sections: BookBackSection[], lesson: string) {
  const flat = sections.flatMap((s) => s.items);
  if (!flat.length) return;
  for (let i = 0; i < flat.length; i += 25) {
    const batch = flat.slice(i, i + 25);
    try {
      const { data } = await generateJSON<{ results: { id: number; supported: boolean; note?: string }[] }>({
        system: `You are a strict checker. You get a Tamil textbook lesson and numbered question–answer pairs from its exercises.
Using ONLY the lesson text (not your own knowledge): supported = true if the lesson clearly supports the given answer (for choose-the-answer, the marked option; for true/false, the verdict).
supported = false if the lesson does not contain it or says something different; then note = one short Tamil sentence saying what is unclear or what the lesson says.
Return JSON {"results":[{"id":0,"supported":true,"note":""}]} with one entry per pair.`,
        user: `=== பாடம் ===\n${lesson}\n\n=== வினா–விடைகள் ===\n${batch.map((it, k) => `[${k}] வினா: ${it.q}${it.options?.length ? `\nவிருப்பங்கள்: ${it.options.join(" / ")}` : ""}\nவிடை: ${it.answer}`).join("\n\n")}`,
        temperature: 0,
        maxTokens: 4096,
      });
      for (const r of data.results ?? []) {
        const it = batch[r.id];
        if (!it) continue;
        it.verified = r.supported === true;
        if (!it.verified && r.note) it.check_note = String(r.note).slice(0, 300);
      }
    } catch {
      /* check unavailable: items stay unmarked (shown without the ✓) */
    }
  }
}

/** 4-option multiple-choice book-back questions go into the question bank (for quizzes / mock tests). */
async function saveToBank(admin: SupabaseClient, ch: Chapter, sections: BookBackSection[]) {
  const { data: anyQ } = await admin.from("questions").select("unit_id").eq("chapter_id", ch.id).not("unit_id", "is", null).limit(1);
  const unit_id = anyQ?.[0]?.unit_id ?? null;
  const rows = sections
    .filter((s) => s.type === "mcq")
    .flatMap((s) => s.items)
    .filter((it) => it.verified === true && it.options?.length === 4 && it.answer_index != null && it.answer_index >= 0 && it.answer_index < 4 && new Set(it.options.map((o) => o.trim())).size === 4)
    .map((it) => ({
      exam_code: ch.std <= 10 ? "G4" : "G2",
      unit_id,
      chapter_id: ch.id,
      stem: it.q,
      options: it.options!,
      answer_index: it.answer_index!,
      explanation: it.explanation || null,
      source_ref: `${ch.book}, பாடம் ${ch.chapter_no}: ${ch.title_ta} – புத்தக வினா${it.page ? `, பக். ${it.page}` : ""}`,
      origin: "bookback",
      difficulty: "easy",
      style: "direct",
      hash: qHash(it.q, it.options!),
    }));
  if (rows.length) await admin.from("questions").upsert(rows, { onConflict: "hash", ignoreDuplicates: true });
}

function withPages(text: string, rows: { content: string; page_from: number }[]) {
  // put [பக்கம் N] markers back in so answers can name their page
  let out = "";
  let last = -1;
  for (const r of rows) {
    if (out.length > text.length) break;
    out += (r.page_from !== last ? `[பக்கம் ${r.page_from}]\n` : "") + r.content + "\n\n";
    last = r.page_from;
  }
  return out;
}
