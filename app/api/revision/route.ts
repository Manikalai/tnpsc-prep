import { route, ok, fail } from "@/lib/api";

export const POST = route<{ limit?: number }>(async ({ sb, user }, b) => {
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const { data } = await sb.from("review_queue").select("question_id").eq("user_id", user.id).lte("due_date", today).order("due_date").limit(b.limit ?? 25);
  const ids = (data ?? []).map((r) => r.question_id);
  if (!ids.length) return fail("இன்று திருப்புதல் செய்ய வினாக்கள் இல்லை 🎉");
  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "revision", title: "திருப்புதல் – தவறிய வினாக்கள்", question_ids: ids, duration_sec: ids.length * 54 })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}` });
});
