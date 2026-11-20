import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Report a mistake. A question is held back (flagged) until reviewed; a lesson note report is listed for review.
export const POST = route<{ questionId?: string; chapterId?: number; kind?: string; reason: string }>(async ({ user }, b) => {
  const admin = supabaseAdmin();
  const reason = (b.reason ?? "").slice(0, 500);
  if (b.questionId) {
    await admin.from("question_reports").insert({ question_id: b.questionId, user_id: user.id, reason });
    await admin.from("questions").update({ status: "flagged" }).eq("id", b.questionId);
    return ok();
  }
  if (b.chapterId) {
    await admin.from("job_runs").insert({ job: "note_report", ok: false, detail: { chapter_id: b.chapterId, kind: b.kind ?? "", reason, user: user.id } });
    return ok();
  }
  return fail("nothing to report");
});
