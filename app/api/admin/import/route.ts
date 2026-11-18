import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { qHash, validate } from "@/lib/questions";

type Item = { stem: string; options: string[]; answer_index: number; unit_id?: string; exam_code?: string; year?: number; explanation?: string };

// Import previous-year questions (JSON array). scripts/pyq_to_json.py turns a TNPSC paper + answer key into this format.
export const POST = route<{ items: Item[] }>(async (_ctx, b) => {
  if (!Array.isArray(b.items) || !b.items.length) return fail("JSON array தேவை");
  const rows = [];
  let skipped = 0;
  for (const it of b.items.slice(0, 1000)) {
    const v = validate(it, { requireTamil: false });
    if (!v) { skipped++; continue; }
    rows.push({
      stem: v.stem,
      options: v.options,
      answer_index: v.answer_index,
      explanation: it.explanation ?? null,
      unit_id: it.unit_id ?? null,
      exam_code: it.exam_code ?? (it.unit_id ? it.unit_id.split("-")[0] : null),
      origin: "pyq",
      difficulty: "medium",
      pyq_year: it.year ?? null,
      source_ref: it.year ? `TNPSC ${it.exam_code ?? ""} ${it.year}` : "TNPSC முந்தைய ஆண்டு வினா",
      hash: qHash(v.stem, v.options),
    });
  }
  const { data, error } = await supabaseAdmin().from("questions").upsert(rows, { onConflict: "hash", ignoreDuplicates: true }).select("id");
  if (error) return fail(error.message);
  return ok({ notice: `${data?.length ?? 0} வினாக்கள் சேர்க்கப்பட்டன, ${skipped} தவிர்க்கப்பட்டன.` });
});
