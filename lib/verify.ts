// Fact-check: a second AI pass reads each AI question next to the textbook passage it came from and
// keeps it only if the passage supports the marked answer. Failing questions are retired.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJSON } from "./ai";

type Row = { id: string; stem: string; options: string[]; answer_index: number; chunk_id: number };
type Verdict = { id: number; supported: boolean; correct_index: number | null; reason: string };

const L = ["அ", "ஆ", "இ", "ஈ"];

export async function verifyBatch(admin: SupabaseClient, rows: Row[]) {
  const { data: chunks } = await admin.from("textbook_chunks").select("id,book,page_from,content").in("id", [...new Set(rows.map((r) => r.chunk_id))]);
  const byId = new Map((chunks ?? []).map((c: { id: number; book: string; page_from: number | null; content: string }) => [c.id, c]));
  const items = rows.map((r, i) => {
    const c = byId.get(r.chunk_id);
    return `### [${i}]
பாடநூல் பகுதி (${c?.book ?? "?"}, பக். ${c?.page_from ?? "?"}):
${c?.content ?? "(missing)"}
வினா: ${r.stem}
${r.options.map((o, k) => `(${L[k]}) ${o}`).join("  ")}
குறிக்கப்பட்ட விடை: (${L[r.answer_index]})`;
  });
  const { data } = await generateJSON<{ results: Verdict[] }>({
    system: `You are a strict exam fact-checker. For each numbered item you get a Tamil textbook passage, a multiple-choice question and the marked answer.
Decide using ONLY the passage (not your own knowledge):
- supported: true only if the passage clearly states the fact needed AND the marked option is the one the passage supports AND no other option is also correct by the passage.
- correct_index: the 0-based index of the option the passage supports (null if none).
- reason: one short English sentence.
Return JSON {"results":[{"id":0,"supported":true,"correct_index":0,"reason":""}]} with one entry per item.`,
    user: items.join("\n\n"),
    temperature: 0,
    maxTokens: 4096,
  });
  let ok = 0, failed = 0;
  const now = new Date().toISOString();
  for (const v of data.results ?? []) {
    const r = rows[v.id];
    if (!r) continue;
    const good = v.supported === true && v.correct_index === r.answer_index;
    await admin
      .from("questions")
      .update(good ? { verified: "ok", verified_at: now, verify_note: null } : { verified: "fail", verified_at: now, verify_note: (v.reason ?? "").slice(0, 300), status: "retired" })
      .eq("id", r.id);
    good ? ok++ : failed++;
  }
  return { ok, failed };
}

/** Check up to `max` unchecked AI questions, 8 per AI call. */
export async function verifyPending(admin: SupabaseClient, max = 400, sleepMs = 6000, log: (s: string) => void = () => {}) {
  let ok = 0, failed = 0, calls = 0;
  while (ok + failed < max) {
    const { data, error } = await admin
      .from("questions")
      .select("id,stem,options,answer_index,chunk_id")
      .eq("origin", "ai")
      .eq("status", "active")
      .is("verified", null)
      .not("chunk_id", "is", null)
      .limit(8);
    if (error) { log(`verify: ${error.message}`); break; } // column missing until migration 0006 is run
    if (!data?.length) break;
    try {
      const r = await verifyBatch(admin, data as Row[]);
      ok += r.ok; failed += r.failed; calls++;
      if (r.ok + r.failed === 0) break;
    } catch (e) {
      log(`verify: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`);
      break;
    }
    await new Promise((res) => setTimeout(res, sleepMs));
  }
  return { ok, failed, calls };
}
