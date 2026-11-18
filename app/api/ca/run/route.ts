import { route, ok } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDaily } from "@/lib/ca";

export const maxDuration = 60;

export const POST = route(async () => {
  const r = await runDaily(supabaseAdmin());
  return ok({ ...r, notice: r.ok ? `${r.notes} குறிப்புகள், ${r.mcqs} வினாக்கள் சேர்க்கப்பட்டன.` : `பிழை: ${r.error}` });
});
