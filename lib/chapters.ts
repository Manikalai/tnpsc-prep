// Per-chapter study material, written from the chapter's own textbook text and cached in chapter_notes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJSON } from "./ai";
import { glossaryText, loadGlossary, qHash, STYLE_GUIDE, textbookRef, validateStrict } from "./questions";

export type Chapter = {
  id: number; book: string; std: number; term: string | null; subject: string; chapter_no: number;
  title_ta: string; page_from: number | null; page_to: number | null; source_url: string | null; section?: string | null;
};

import { DIFFICULTY, SECTIONS } from "./chapter-labels";
export { DIFFICULTY, SECTIONS };

/** Label chapters with a section from their titles (one AI call per book). Returns how many were labelled. */
export async function classifyChapters(admin: SupabaseClient, limitBooks = 40) {
  const { data } = await admin.from("chapters").select("id,book,subject,chapter_no,title_ta").is("section", null).limit(3000);
  const rows = (data ?? []) as { id: number; book: string; subject: string; chapter_no: number; title_ta: string }[];
  const books = [...new Set(rows.map((r) => `${r.book}|${r.subject}`))].slice(0, limitBooks);
  let n = 0;
  for (const key of books) {
    const [book, subject] = key.split("|");
    const list = rows.filter((r) => r.book === book && r.subject === subject);
    const allowed = Object.keys(SECTIONS[subject] ?? {});
    if (!allowed.length) continue;
    try {
      const { data: out } = await generateJSON<{ items: { id: number; section: string }[] }>({
        system: `Classify each chapter of the Tamil Nadu textbook "${book}" into one section: ${allowed.map((k) => `${k} (${SECTIONS[subject][k]})`).join(", ")}.
Use the chapter title (Samacheer Social Science books have History, Geography, Civics and Economics units; Science books have Physics, Chemistry and Biology lessons; for 11th/12th single-subject books use that subject).
Return JSON {"items":[{"id":0,"section":""}]}`,
        user: list.map((r) => `${r.id}: ${r.chapter_no}. ${r.title_ta}`).join("\n"),
        temperature: 0,
      });
      for (const it of out.items ?? []) {
        if (!allowed.includes(it.section) || !list.some((r) => r.id === it.id)) continue;
        await admin.from("chapters").update({ section: it.section }).eq("id", it.id);
        n++;
      }
    } catch {
      /* try again next run */
    }
  }
  return n;
}
export type Summary = { summary: string; points: string[] };
export type Facts = { dates: { date: string; event: string }[]; persons: { name: string; about: string }[]; facts: string[]; terms: { term: string; meaning: string }[] };
export type Revision = { items: { q: string; a: string }[] };
export const NOTE_KINDS = ["summary", "facts", "revision"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export async function chapterText(sb: SupabaseClient, chapterId: number, maxChars = 60000) {
  const { data } = await sb.from("textbook_chunks").select("id,content,page_from").eq("chapter_id", chapterId).order("page_from").order("id").limit(400);
  const rows = (data ?? []) as { id: number; content: string; page_from: number }[];
  let text = "";
  for (const r of rows) {
    if (text.length > maxChars) break;
    text += r.content + "\n\n";
  }
  return { text, rows };
}

const PROMPTS: Record<NoteKind, string> = {
  summary: `Write revision notes for this chapter.
"summary": a one-page summary in Tamil as markdown (short headings and bullet points, the most exam-relevant facts first).
"points": 10–20 one-line முக்கியக் குறிப்புகள் (key points) most likely to be asked in TNPSC.
Return JSON {"summary":"","points":[""]}`,
  facts: `Extract exam facts from this chapter, in Tamil.
"dates": every year/date with what happened (oldest first).
"persons": every important person with one line on who they are / what they did.
"facts": other one-line facts likely to be asked (numbers, firsts, places, articles, laws, scientific facts).
"terms": key terms (கலைச்சொற்கள்) with their meaning, including the English term in brackets where the book gives it.
Only include what is in the text. Return JSON {"dates":[{"date":"","event":""}],"persons":[{"name":"","about":""}],"facts":[""],"terms":[{"term":"","meaning":""}]}`,
  revision: `Write 15–20 short revision questions in Tamil (one-line answers) that test recall of this chapter — the kind a student answers from memory before the exam.
Return JSON {"items":[{"q":"","a":""}]}`,
};

export async function generateChapterNote(admin: SupabaseClient, ch: Chapter, kind: NoteKind, timeoutMs?: number) {
  const { text } = await chapterText(admin, ch.id, kind === "facts" ? 60000 : 45000);
  if (!text.trim()) throw new Error("இந்தப் பாடத்தின் உரை இன்னும் ஏற்றப்படவில்லை");
  const glossary = await loadGlossary(admin);
  const { data } = await generateJSON<Summary | Facts | Revision>({
    system: `You prepare TNPSC study material in correct formal Tamil (Tamil medium, Samacheer Kalvi wording). Official terms: ${glossaryText(glossary)}.
Use ONLY the chapter text given. Do not add facts, dates or names that are not in it.
${PROMPTS[kind]}`,
    user: `நூல்: ${ch.book}\nபாடம் ${ch.chapter_no}: ${ch.title_ta}\n\n${text}`,
    temperature: 0.3,
    maxTokens: 8192,
    timeoutMs,
  });
  await admin.from("chapter_notes").upsert({ chapter_id: ch.id, kind, content: data });
  return data;
}

/** Map a chapter to the syllabus units its questions should count towards in mock tests. */
async function candidateUnits(admin: SupabaseClient, ch: Chapter) {
  const exam = ch.std <= 10 ? "G4" : "G2";
  const subjects =
    ch.subject === "tamil" ? ["tamil", "tn"] : ch.subject === "science" ? ["science"] : ["history", "polity", "economy", "geography", "tn", "current"];
  const { data } = await admin.from("units").select("id,name_ta,exam_code").eq("exam_code", exam).in("subject", subjects);
  return (data ?? []) as { id: string; name_ta: string; exam_code: string }[];
}

/** Write `n` MCQs from the chapter text and store them (linked to the chapter and the best-matching unit). */
export async function generateChapterMCQs(admin: SupabaseClient, ch: Chapter, n = 10, timeoutMs?: number, difficulty: string = "mixed") {
  const { rows } = await chapterText(admin, ch.id);
  if (!rows.length) throw new Error("இந்தப் பாடத்தின் உரை இன்னும் ஏற்றப்படவில்லை");
  const pick = [...rows].sort(() => Math.random() - 0.5).slice(0, 8).sort((a, b) => a.page_from - b.page_from);
  const units = await candidateUnits(admin, ch);
  const glossary = await loadGlossary(admin);
  const { data } = await generateJSON<{ questions: (Record<string, unknown> & { unit_id?: string })[] }>({
    system: `You write TNPSC exam MCQs in correct formal Tamil for Tamil-medium candidates. Official terms: ${glossaryText(glossary)}.
Every fact must come ONLY from the numbered textbook passages — never your own knowledge. Every question MUST give "source" (passage number), "explanation" and "difficulty". Exactly 4 options, one correct.
Do not invent grammar rules, verse lines or quotations. explanation: 1–2 Tamil sentences.
Difficulty: ${difficulty === "easy" ? "easy — direct one-fact questions on the main points" : difficulty === "hard" ? "hard — statement-based (I, II, III), assertion–reason and match-the-following questions on finer details, dates and names, with close distractors" : difficulty === "medium" ? "medium — mix of direct and statement/match questions" : "mix easy, medium and hard"}. Set "difficulty" on each question to easy, medium or hard.
For each question choose "unit_id" from: ${units.map((u) => `${u.id} = ${u.name_ta}`).join("; ")}.
${STYLE_GUIDE}
Return JSON {"questions":[{"stem":"","options":["","","",""],"answer_index":0,"explanation":"","source":0,"style":"direct","difficulty":"medium","unit_id":""}]}`,
    user: `பாடம்: ${ch.title_ta} (${ch.book})\n${n} வினாக்கள்.\n\n${pick.map((r, i) => `[${i}] (பக். ${r.page_from})\n${r.content}`).join("\n\n")}`,
    temperature: 0.6,
    timeoutMs,
  });
  const validUnits = new Set(units.map((u) => u.id));
  const out = [];
  for (const raw of data.questions ?? []) {
    const q = validateStrict(raw, pick.length);
    if (!q) continue; // every question needs 4 choices, answer, explanation, its passage and a difficulty
    const src = pick[q.source];
    const unit = typeof raw.unit_id === "string" && validUnits.has(raw.unit_id) ? raw.unit_id : null;
    out.push({
      exam_code: unit ? unit.split("-")[0] : null,
      unit_id: unit,
      chapter_id: ch.id,
      stem: q.stem,
      options: q.options,
      answer_index: q.answer_index,
      explanation: q.explanation,
      source_ref: textbookRef({ book: ch.book, page_from: src.page_from }, ch),
      chunk_id: src.id,
      origin: "ai",
      style: q.style ?? null,
      difficulty: difficulty !== "mixed" && q.difficulty === "medium" && !raw.difficulty ? difficulty : q.difficulty,
      hash: qHash(q.stem, q.options),
    });
  }
  if (!out.length) return [];
  const { data: ins } = await admin.from("questions").upsert(out, { onConflict: "hash", ignoreDuplicates: true }).select("id");
  return (ins ?? []).map((r: { id: string }) => r.id);
}
