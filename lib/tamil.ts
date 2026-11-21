// பொதுத் தமிழ் (General Tamil, Group 4 Part A — 100 of the 200 questions).
// Questions are written ONLY from her Tamil textbooks (6th–12th): the grammar box (கற்கண்டு), the author/book box
// (நூல்வெளி), the poems and lessons. A second strict pass checks every answer against the same passages;
// anything not supported is dropped. Questions are tagged style = "gt:<topic>".
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJSON } from "./ai";
import { chapterText, type Chapter } from "./chapters";
import { qHash, textbookRef, validateStrict } from "./questions";

export const GT_TOPICS = [
  { key: "pirithu", ta: "பிரித்து / சேர்த்து எழுதுதல்", unit: "G4-TAMIL-1", hint: "split or join words (புணர்ச்சி)" },
  { key: "ilakkanam", ta: "இலக்கணக் குறிப்பு", unit: "G4-TAMIL-1", hint: "grammar type of a word: வினைத்தொகை, உம்மைத்தொகை, பண்புத்தொகை, உவமைத்தொகை, வினையெச்சம், பெயரெச்சம், தொழிற்பெயர், அளபெடை, அணி, etc." },
  { key: "pizhai", ta: "பிழை திருத்தம்", unit: "G4-TAMIL-1", hint: "correct sentence: சந்திப்பிழை, ஒருமை–பன்மை, மரபுப் பிழை, வழூஉச் சொல்" },
  { key: "ethir", ta: "எதிர்ச்சொல் / பொருள்", unit: "G4-TAMIL-2", hint: "antonym or meaning of a word used in the lesson" },
  { key: "verchol", ta: "வேர்ச்சொல் / வினை வடிவம்", unit: "G4-TAMIL-1", hint: "root word, verb forms (வினைமுற்று, ஏவல்)" },
  { key: "kalaichol", ta: "கலைச்சொல் (ஆங்கிலம் → தமிழ்)", unit: "G4-TAMIL-4", hint: "English technical term → Tamil term listed in the lesson's கலைச்சொல் box" },
  { key: "nool", ta: "நூல் – ஆசிரியர்", unit: "G4-TAMIL-7", hint: "which author wrote which book, from the நூல்வெளி box" },
  { key: "arignar", ta: "தமிழறிஞர்கள் · தமிழ்த்தொண்டு", unit: "G4-TAMIL-7", hint: "facts about Tamil scholars: birthplace, pen name (புனைபெயர்), titles, works, service to Tamil" },
  { key: "ilakkiyam", ta: "இலக்கியம் · செய்யுள்", unit: "G4-TAMIL-7", hint: "the poem/text: which work a line is from, its period, sangam/epic facts, meaning of a line" },
  { key: "porutthu", ta: "பொருத்துக", unit: "G4-TAMIL-7", hint: "match-the-following on authors, works, terms (options are code combinations)" },
] as const;
export type GtTopic = (typeof GT_TOPICS)[number]["key"];
export const GT_BY_KEY = Object.fromEntries(GT_TOPICS.map((t) => [t.key, t])) as Record<GtTopic, (typeof GT_TOPICS)[number]>;

export type NoolEntry = { nool: string; asiriyar: string; about: string };

type Raw = Record<string, unknown> & { topic?: string };

/** Writes General-Tamil questions + author/book facts for one Tamil lesson, then checks them strictly. */
export async function buildTamilLesson(admin: SupabaseClient, ch: Chapter) {
  const { rows } = await chapterText(admin, ch.id, 45000);
  if (!rows.length) throw new Error("no text");
  const passages = rows.map((r, i) => `[${i}] (பக். ${r.page_from})\n${r.content}`).join("\n\n");
  const { data } = await generateJSON<{ questions: Raw[]; nool: (NoolEntry & { source?: number })[] }>({
    system: `You prepare TNPSC Group 4 "பொதுத் தமிழ்" (General Tamil, Part A) practice from a Tamil school textbook lesson, in correct formal Tamil.
STRICT: every fact, word, grammar label and line must come ONLY from the numbered passages. Never use your own knowledge; never invent verse lines, authors, dates or grammar rules.
1) "questions": up to 12 MCQs in real TNPSC General Tamil styles, spread over these topics (use only those the lesson actually supports):
${GT_TOPICS.map((t) => `- ${t.key}: ${t.ta} — ${t.hint}`).join("\n")}
Each: {"topic":"<key>","stem":"","options":["","","",""],"answer_index":0,"explanation":"1–2 Tamil sentences, quoting the lesson","source":<passage number>,"difficulty":"easy|medium|hard","style":"direct|match|odd"}.
Exactly 4 distinct options, one correct. For பொருத்துக use the standard 4-row match format in the stem and code options like "அ-2, ஆ-4, இ-1, ஈ-3".
2) "nool": every book/work with its author that the lesson names (especially the நூல்வெளி box): {"nool":"","asiriyar":"","about":"one short Tamil line from the lesson","source":<passage number>}. Empty list if none.
Return JSON {"questions":[...],"nool":[...]}`,
    user: `பாடம்: ${ch.title_ta} (${ch.book})\n\n${passages}`,
    temperature: 0.4,
    maxTokens: 8192,
  });

  // strict check: answers + author/book pairs against the same passages
  const qs = (data.questions ?? []).map((raw) => ({ raw, q: validateStrict(raw, rows.length) })).filter((x) => x.q && GT_BY_KEY[x.raw.topic as GtTopic]);
  const nool = (data.nool ?? []).filter((n) => n?.nool && n?.asiriyar).slice(0, 20);
  const { data: chk } = await generateJSON<{ q: { id: number; ok: boolean }[]; n: { id: number; ok: boolean }[] }>({
    system: `You are a strict checker for a Tamil exam. Using ONLY the lesson passages (not your own knowledge):
q: for each question, ok = true only if the passages clearly support the marked answer AND no other option is also correct.
n: for each book–author pair, ok = true only if the passages say this author wrote this book.
Return JSON {"q":[{"id":0,"ok":true}],"n":[{"id":0,"ok":true}]}`,
    user: `=== பாடம் ===\n${passages}\n\n=== வினாக்கள் ===\n${qs.map((x, i) => `[${i}] ${x.q!.stem}\n${x.q!.options.map((o, j) => `${"அஆஇஈ"[j]}) ${o}`).join("  ")}\nவிடை: ${"அஆஇஈ"[x.q!.answer_index]}`).join("\n\n")}\n\n=== நூல் – ஆசிரியர் ===\n${nool.map((n, i) => `[${i}] ${n.nool} — ${n.asiriyar}`).join("\n")}`,
    temperature: 0,
    maxTokens: 4096,
  });
  const okQ = new Set((chk.q ?? []).filter((r) => r.ok === true).map((r) => r.id));
  const okN = new Set((chk.n ?? []).filter((r) => r.ok === true).map((r) => r.id));

  const out = qs.filter((_, i) => okQ.has(i)).map(({ raw, q }) => {
    const t = GT_BY_KEY[raw.topic as GtTopic];
    const src = rows[q!.source];
    return {
      exam_code: "G4", unit_id: t.unit, chapter_id: ch.id,
      stem: q!.stem, options: q!.options, answer_index: q!.answer_index, explanation: q!.explanation,
      source_ref: textbookRef({ book: ch.book, page_from: src.page_from }, ch), chunk_id: src.id,
      origin: "ai", status: "unchecked", style: `gt:${t.key}`, difficulty: q!.difficulty, hash: qHash(q!.stem, q!.options),
    };
  });
  if (out.length) await admin.from("questions").upsert(out, { onConflict: "hash", ignoreDuplicates: true });
  const noolOk: NoolEntry[] = nool.filter((_, i) => okN.has(i)).map((n) => ({ nool: String(n.nool).trim(), asiriyar: String(n.asiriyar).trim(), about: String(n.about ?? "").trim().slice(0, 200) }));
  await admin.from("chapter_notes").upsert({ chapter_id: ch.id, kind: "tamil", content: { nool: noolOk, questions: out.length, checked: true } });
  return { questions: out.length, dropped: qs.length - out.length, nool: noolOk.length };
}
