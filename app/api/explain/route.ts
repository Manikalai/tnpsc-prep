import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai";
import { findPassages } from "@/lib/retrieve";
import { glossaryText, loadGlossary } from "@/lib/questions";

export const maxDuration = 60;

export type Explanation = {
  why_right: string;
  options: { option: string; why: string }[];
  tip: string;
  related: string[];
  source?: string | null;
};

// Detailed Tamil explanation of one question: why the answer is right, why each other option is wrong,
// a memory tip and related facts — grounded in the textbook passage when one is available. Cached.
export const POST = route<{ questionId: string }>(async (_ctx, b) => {
  const admin = supabaseAdmin();
  const { data: cached } = await admin.from("question_explanations").select("content").eq("question_id", b.questionId).maybeSingle();
  if (cached) return ok(cached.content);

  const { data: q } = await admin.from("questions").select("*").eq("id", b.questionId).single();
  if (!q) return fail("வினா கிடைக்கவில்லை");

  // textbook context: the passage the question came from, else the closest passages
  let passages: { book: string; page_from: number | null; content: string }[] = [];
  if (q.chunk_id) {
    const { data } = await admin.from("textbook_chunks").select("book,page_from,content").eq("id", q.chunk_id).limit(1);
    passages = data ?? [];
  }
  if (!passages.length) {
    try {
      passages = await findPassages(admin, { text: `${q.stem} ${(q.options as string[])[q.answer_index]}`, count: 3 });
    } catch {
      /* no textbooks loaded yet */
    }
  }
  if (!passages.length) return fail("பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை — விளக்கம் பாடநூல் உரையிலிருந்து மட்டுமே எழுதப்படும்.");
  const glossary = await loadGlossary(admin);
  const opts = q.options as string[];
  const { data } = await generateJSON<Explanation>({
    system: `You are a patient TNPSC teacher explaining an exam question to a Tamil-medium candidate, in clear formal Tamil. Official terms: ${glossaryText(glossary)}.
The correct answer is given — do not change it. Explain ONLY from the textbook passages; never add your own knowledge.
Return JSON:
{"why_right":"2–4 sentences on why the correct answer is right",
 "options":[{"option":"<each WRONG option text>","why":"one sentence on why it is wrong / what it actually refers to"}],
 "tip":"one short memory trick for this fact",
 "related":["2–4 related one-line facts from the same topic that TNPSC also asks"]}`,
    user: `வினா: ${q.stem}
விடைகள்: ${opts.map((o, i) => `(${["அ", "ஆ", "இ", "ஈ"][i]}) ${o}`).join("  ")}
சரியான விடை: (${["அ", "ஆ", "இ", "ஈ"][q.answer_index]}) ${opts[q.answer_index]}
${q.explanation ? `சுருக்க விளக்கம்: ${q.explanation}` : ""}

${passages.map((p, i) => `[${i + 1}] (${p.book}${p.page_from ? `, பக். ${p.page_from}` : ""})\n${p.content}`).join("\n\n")}`,
    temperature: 0.3,
    timeoutMs: 50000,
  });
  const content: Explanation = {
    why_right: data.why_right ?? "",
    options: (data.options ?? []).filter((o) => o?.option && o?.why),
    tip: data.tip ?? "",
    related: (data.related ?? []).filter(Boolean),
    source: passages[0] ? `${passages[0].book}${passages[0].page_from ? `, பக். ${passages[0].page_from}` : ""}` : null,
  };
  await admin.from("question_explanations").upsert({ question_id: q.id, content }); // ignored if the table is missing
  return ok(content);
});
