import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreTest, updateReview } from "@/lib/exam";

export const POST = route<{ testId: string; answers: Record<string, number | null>; times?: Record<string, number>; elapsedSec?: number }>(
  async ({ sb, user }, b) => {
    const { data: test } = await sb.from("tests").select("*").eq("id", b.testId).eq("user_id", user.id).single();
    if (!test) return fail("தேர்வு கிடைக்கவில்லை", 404);
    if (test.submitted_at) return ok({ redirect: `/test/${test.id}/result` });
    const admin = supabaseAdmin();
    const s = await scoreTest(admin, test, b.answers ?? {});
    const rows = s.answers.map((a) => ({ ...a, test_id: test.id, user_id: user.id, time_ms: b.times?.[a.question_id] ?? null }));
    const { error } = await sb.from("answers").upsert(rows);
    if (error) return fail(error.message);
    await sb
      .from("tests")
      .update({ submitted_at: new Date().toISOString(), score: s.score, max_score: s.maxScore, result: { ...s.result, elapsedSec: b.elapsedSec ?? null } })
      .eq("id", test.id);
    await updateReview(sb, user.id, s.answers);
    return ok({ redirect: `/test/${test.id}/result` });
  }
);
