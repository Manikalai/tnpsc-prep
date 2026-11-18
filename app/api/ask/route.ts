import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embed, generateJSON } from "@/lib/ai";
import { glossaryText, loadGlossary, type Chunk } from "@/lib/questions";

export const maxDuration = 60;

export const POST = route<{ question: string }>(async (_ctx, b) => {
  const question = (b.question ?? "").trim().slice(0, 600);
  if (!question) return fail("வினாவை எழுதவும்");
  const admin = supabaseAdmin();
  let chunks: Chunk[] = [];
  try {
    const [vec] = await embed([question], "RETRIEVAL_QUERY");
    const { data } = await admin.rpc("match_chunks", { query_embedding: vec as unknown as string, match_count: 6, subjects: null, max_std: 12 });
    chunks = (data ?? []) as Chunk[];
  } catch {
    /* no textbooks yet */
  }
  if (!chunks.length) return fail("பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை — விடைகள் பாடநூல் உரையிலிருந்து மட்டுமே தரப்படும்.");
  const glossary = await loadGlossary(admin);
  const passages = chunks.map((c, i) => `[${i + 1}] (${c.book}${c.page_from ? `, பக். ${c.page_from}` : ""})\n${c.content}`).join("\n\n");
  const { data } = await generateJSON<{ answer: string; used: number[] }>({
    system: `Answer the TNPSC candidate's doubt in clear Tamil (Tamil medium). Official terms: ${glossaryText(glossary)}.
Answer ONLY from the numbered Samacheer textbook passages and cite them like [1]. If the passages don't contain the answer, say so in Tamil and give what they do contain. Never add your own knowledge.
Use short paragraphs or bullet points (markdown). Return JSON: {"answer":"","used":[1]}`,
    user: `வினா: ${question}\n\n${passages}`,
    temperature: 0.3,
    timeoutMs: 50000,
  });
  const sources = (data.used ?? []).map((n) => chunks[n - 1]).filter(Boolean).map((c) => ({ book: c.book, page: c.page_from }));
  return ok({ answer: data.answer, sources, grounded: chunks.length > 0 });
});
