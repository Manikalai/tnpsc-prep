import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai";
import { glossaryText, loadGlossary, retrieveForUnit, type Unit } from "@/lib/questions";
import { maxStdFor } from "@/lib/exam";

export const maxDuration = 60;

type Gen = {
  mnemonic?: { title: string; content: string };
  summary?: { title: string; content: string };
  table?: { title: string; content: string };
  facts?: { q: string; a: string }[];
};

export const POST = route<{ action: "generate" | "pin" | "delete"; unitId?: string; topicId?: string; id?: string; pinned?: boolean }>(
  async ({ sb, user }, b) => {
    if (b.action === "pin") {
      await sb.from("notes").update({ pinned: !!b.pinned }).eq("id", b.id!).eq("user_id", user.id);
      return ok();
    }
    if (b.action === "delete") {
      await sb.from("notes").delete().eq("id", b.id!).eq("user_id", user.id);
      return ok();
    }
    const admin = supabaseAdmin();
    const { data: unit, error: unitErr } = await admin.from("units").select("*").eq("id", b.unitId!).single();
    if (!unit) return fail(unitErr ? `தரவுத்தளப் பிழை (SUPABASE_SERVICE_ROLE_KEY சரியா?): ${unitErr.message}` : "அலகு கிடைக்கவில்லை");
    const { data: topic } = b.topicId ? await admin.from("topics").select("id,name_ta").eq("id", b.topicId).single() : { data: null };
    const focus = topic?.name_ta ?? unit.name_ta;
    const chunks = await retrieveForUnit(admin, unit as Unit, focus, maxStdFor(unit.exam_code), 8);
    const glossary = await loadGlossary(admin);
    const passages = chunks.map((c, i) => `[${i}] (${c.book}${c.page_from ? `, பக். ${c.page_from}` : ""})\n${c.content}`).join("\n\n");
    const { data } = await generateJSON<Gen>({
      system: `You make revision material in Tamil for TNPSC candidates who study in Tamil medium. Official terms: ${glossaryText(glossary)}.
${chunks.length ? "Use only facts from the numbered textbook passages." : "No passages are available: use only well-established textbook facts."}
Produce:
1. mnemonic: a short Tamil memory trick (first-letter word, rhyme or story) for a list in this topic, with what each letter stands for.
2. summary: a one-page Tamil summary in markdown bullet points (most-asked facts first).
3. table: a markdown table (comparison or timeline) that helps memorise this topic.
4. facts: 10 flashcards {q, a} — short question in Tamil, short answer.
Return JSON: {"mnemonic":{"title":"","content":""},"summary":{"title":"","content":""},"table":{"title":"","content":""},"facts":[{"q":"","a":""}]}`,
      user: `அலகு: ${unit.name_ta}\nதலைப்பு: ${focus}\n\n${passages}`,
      temperature: 0.5,
    });
    const source_ref = chunks.length ? [...new Set(chunks.map((c) => c.book))].join("; ") : "பாடநூல் ஆதாரம் இல்லை – சரிபார்க்கவும்";
    const rows = (["mnemonic", "summary", "table"] as const)
      .filter((k) => data[k]?.content)
      .map((k) => ({ user_id: user.id, unit_id: unit.id, topic_id: topic?.id ?? null, kind: k, title: data[k]!.title || focus, content: data[k]!.content, source_ref }));
    if (rows.length) await sb.from("notes").insert(rows);
    const cards = (data.facts ?? []).filter((f) => f?.q && f?.a).map((f) => ({ user_id: user.id, unit_id: unit.id, front: f.q, back: f.a }));
    if (cards.length) await sb.from("flashcards").insert(cards);
    return ok({ notes: rows.length, cards: cards.length });
  }
);
