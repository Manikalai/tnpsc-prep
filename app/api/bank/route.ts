import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateForUnit, type Unit } from "@/lib/questions";
import { maxStdFor } from "@/lib/exam";

export const maxDuration = 60;

// Adds ~10 questions to one unit's bank (the nightly job does this for every unit automatically).
export const POST = route<{ unitId: string }>(async (_ctx, b) => {
  const admin = supabaseAdmin();
  const { data: unit, error: unitErr } = await admin.from("units").select("*").eq("id", b.unitId).single();
  if (!unit) return fail(unitErr ? `தரவுத்தளப் பிழை (SUPABASE_SERVICE_ROLE_KEY சரியா?): ${unitErr.message}` : "அலகு கிடைக்கவில்லை");
  const { data: topics } = await admin.from("topics").select("id,name_ta").eq("unit_id", unit.id);
  const r = await generateForUnit(admin, unit as Unit, { n: 6, topics: topics ?? [], maxStd: maxStdFor(unit.exam_code), timeoutMs: 45000 });
  if (!r.grounded) return fail(r.errors[0]);
  return ok({ notice: `${r.ids.length} புதிய வினாக்கள் சேர்க்கப்பட்டன` });
});
