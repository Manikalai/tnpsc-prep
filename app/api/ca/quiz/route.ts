import { route, ok, fail } from "@/lib/api";
import { shuffle } from "@/lib/questions";

export const POST = route<{ date?: string; from?: string; to?: string }>(async ({ sb, user }, b) => {
  let q = sb.from("questions").select("id").eq("origin", "ca").eq("status", "active").limit(300);
  if (b.date) q = q.eq("ca_date", b.date);
  if (b.from) q = q.gte("ca_date", b.from);
  if (b.to) q = q.lte("ca_date", b.to);
  const { data } = await q;
  const ids = shuffle((data ?? []).map((r) => r.id)).slice(0, b.date ? 15 : 30);
  if (!ids.length) return fail("இந்தத் தேதிக்கு வினாக்கள் இல்லை");
  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "ca", title: b.date ? `நடப்பு நிகழ்வுகள் – ${b.date}` : "நடப்பு நிகழ்வுகள் – தொகுப்பு", question_ids: ids, duration_sec: ids.length * 54 })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}` });
});
