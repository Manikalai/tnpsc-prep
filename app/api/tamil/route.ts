import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { shuffle } from "@/lib/questions";
import { GT_BY_KEY, type GtTopic } from "@/lib/tamil";

// Start a பொதுத் தமிழ் quiz: one topic (gt:<key>), real previous-year Tamil questions ("pyq"), or a mix ("all").
export const POST = route<{ topic: string; count?: number }>(async ({ sb, user }, b) => {
  const admin = supabaseAdmin();
  const count = Math.min(Math.max(b.count ?? 15, 5), 50);
  let q = admin.from("questions").select("id").eq("status", "active").limit(3000);
  let title = "பொதுத் தமிழ்";
  if (b.topic === "pyq") { q = q.eq("origin", "pyq").like("unit_id", "G4-TAMIL-%"); title = "பொதுத் தமிழ் – முந்தைய ஆண்டு வினாக்கள்"; }
  else if (b.topic === "all") { q = q.like("unit_id", "G4-TAMIL-%"); title = "பொதுத் தமிழ் – கலவை"; }
  else if (GT_BY_KEY[b.topic as GtTopic]) { q = q.eq("style", `gt:${b.topic}`); title = `பொதுத் தமிழ் – ${GT_BY_KEY[b.topic as GtTopic].ta}`; }
  else return fail("bad topic");
  const [{ data: bank }, { data: seen }] = await Promise.all([q, admin.from("answers").select("question_id").eq("user_id", user.id).limit(20000)]);
  const all = (bank ?? []).map((r) => r.id);
  if (!all.length) return fail("இந்தப் பகுதிக்கு வினாக்கள் இன்னும் தயாராகவில்லை — விரைவில் வரும்.");
  const seenSet = new Set((seen ?? []).map((r) => r.question_id));
  const ids = [...shuffle(all.filter((id) => !seenSet.has(id))), ...shuffle(all.filter((id) => seenSet.has(id)))].slice(0, count);
  const { data: test, error } = await sb.from("tests")
    .insert({ user_id: user.id, kind: "quiz", exam_code: "G4", title, question_ids: ids, duration_sec: ids.length * 45 })
    .select("id").single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}` });
});
