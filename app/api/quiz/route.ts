import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateForUnit, shuffle, type Unit } from "@/lib/questions";
import { maxStdFor } from "@/lib/exam";

export const maxDuration = 60;

export const POST = route<{ unitId: string; topicId?: string; count?: number }>(async ({ sb, user }, b) => {
  const admin = supabaseAdmin();
  const count = Math.min(Math.max(b.count ?? 15, 5), 30);
  const { data: unit, error: unitErr } = await admin.from("units").select("*").eq("id", b.unitId).single();
  if (!unit) return fail(unitErr ? `தரவுத்தளப் பிழை (SUPABASE_SERVICE_ROLE_KEY சரியா?): ${unitErr.message}` : "அலகு கிடைக்கவில்லை");
  const { data: topics } = await admin.from("topics").select("id,name_ta").eq("unit_id", unit.id).order("sort");
  const topic = b.topicId ? topics?.find((t) => t.id === b.topicId) : undefined;

  let q = admin.from("questions").select("id").eq("unit_id", unit.id).eq("status", "active").limit(800);
  if (topic) q = q.eq("topic_id", topic.id);
  const [{ data: bank }, { data: seen }] = await Promise.all([
    q,
    admin.from("answers").select("question_id").eq("user_id", user.id).limit(20000),
  ]);
  const seenSet = new Set((seen ?? []).map((r) => r.question_id));
  let ids = shuffle((bank ?? []).map((r) => r.id).filter((id) => !seenSet.has(id))).slice(0, count);
  if (ids.length < count && topic) {
    const { data: unitBank } = await admin.from("questions").select("id").eq("unit_id", unit.id).eq("status", "active").limit(800);
    const extra = shuffle((unitBank ?? []).map((r) => r.id).filter((id) => !seenSet.has(id) && !ids.includes(id)));
    ids = [...ids, ...extra].slice(0, count);
  }

  let notice: string | undefined;
  if (ids.length < count) {
    const gen = await generateForUnit(admin, unit as Unit, {
      n: Math.min(count - ids.length, 6), // small batch so the request finishes inside Vercel's 60 s
      timeoutMs: 45000,
      topic,
      topics: topics ?? [],
      maxStd: maxStdFor(unit.exam_code),
    });
    ids = [...ids, ...gen.ids].slice(0, count);
    if (!gen.grounded) notice = "பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை — இந்த வினாக்கள் பாடநூல் ஆதாரமின்றி உருவாக்கப்பட்டவை; விடைகளைச் சரிபார்க்கவும்.";
    if (ids.length === 0)
      return fail("AI இப்போது மெதுவாக உள்ளது, வினா வங்கியிலும் இந்த அலகுக்கு வினாக்கள் இல்லை. சிறிது நேரம் கழித்து முயலவும் — இரவுப் பணி வங்கியை நிரப்பும்.");
    if (ids.length < count) notice = (notice ? notice + " " : "") + `இப்போது ${ids.length} வினாக்கள் மட்டும் தயார்; இரவுப் பணி வங்கியை நிரப்பிய பின் முழு எண்ணிக்கை கிடைக்கும்.`;
  }
  // still short? reuse already-answered questions
  if (ids.length < count) {
    const extra = shuffle((bank ?? []).map((r) => r.id).filter((id) => !ids.includes(id))).slice(0, count - ids.length);
    ids = [...ids, ...extra];
  }

  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "quiz", exam_code: unit.exam_code, unit_id: unit.id, title: topic ? `${unit.name_ta} – ${topic.name_ta}` : unit.name_ta, question_ids: ids, duration_sec: ids.length * 54 })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}`, notice });
});
