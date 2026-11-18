import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assembleMock } from "@/lib/exam";

export const maxDuration = 60;

export const POST = route<{ exam: string; allowShort?: boolean }>(async ({ sb, user }, b) => {
  const admin = supabaseAdmin();
  const { exam, picked, shortage } = await assembleMock(admin, user.id, b.exam);
  if (picked.length === 0) return fail("வினா வங்கியில் இன்னும் வினாக்கள் இல்லை. 'வினா வங்கி' பகுதியில் வினாக்களை உருவாக்கவும்.");
  const { data: test, error } = await sb
    .from("tests")
    .insert({
      user_id: user.id,
      kind: "mock",
      exam_code: exam.code,
      title: `${exam.name_ta} – மாதிரித் தேர்வு`,
      question_ids: picked,
      duration_sec: Math.round(exam.duration_min * 60 * (picked.length / exam.total_questions)),
    })
    .select("id")
    .single();
  if (error) return fail(error.message);
  const notice = shortage.length
    ? `வினா வங்கியில் போதுமான வினாக்கள் இல்லாததால் ${picked.length}/${exam.total_questions} வினாக்கள் மட்டும் உள்ளன. நேரமும் அதற்கேற்பக் குறைக்கப்பட்டது.`
    : undefined;
  return ok({ redirect: `/test/${test.id}`, notice });
});
