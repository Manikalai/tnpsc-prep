import { route, ok } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route<{ questionId: string; reason: string }>(async ({ user }, b) => {
  const admin = supabaseAdmin();
  await admin.from("question_reports").insert({ question_id: b.questionId, user_id: user.id, reason: (b.reason ?? "").slice(0, 500) });
  await admin.from("questions").update({ status: "flagged" }).eq("id", b.questionId);
  return ok();
});
