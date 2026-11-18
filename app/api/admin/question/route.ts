import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route<{ id: string; action: "retire" | "activate" | "fix"; answer_index?: number; explanation?: string }>(async (_ctx, b) => {
  const admin = supabaseAdmin();
  if (b.action === "retire") await admin.from("questions").update({ status: "retired" }).eq("id", b.id);
  else if (b.action === "activate") await admin.from("questions").update({ status: "active" }).eq("id", b.id);
  else if (b.action === "fix") {
    if (b.answer_index == null || b.answer_index < 0 || b.answer_index > 3) return fail("bad answer");
    await admin.from("questions").update({ status: "active", answer_index: b.answer_index, explanation: b.explanation ?? null }).eq("id", b.id);
  }
  return ok();
});
