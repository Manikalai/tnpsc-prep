import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { shuffle } from "@/lib/questions";

const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

// Daily practice: 20 questions — revision due today, your weakest units, then fresh questions and current affairs.
export const POST = route(async ({ sb, user }) => {
  const today = todayIST();
  const startIST = new Date(`${today}T00:00:00+05:30`).toISOString();
  const { data: existing } = await sb.from("tests").select("id,submitted_at").eq("user_id", user.id).eq("kind", "daily").gte("started_at", startIST).order("started_at", { ascending: false }).limit(1);
  if (existing?.[0] && !existing[0].submitted_at) return ok({ redirect: `/test/${existing[0].id}` });

  const admin = supabaseAdmin();
  const { data: prof } = await sb.from("profiles").select("target_exam").eq("id", user.id).single();
  const exam = prof?.target_exam ?? "G4";
  const [{ data: due }, { data: acc }, { data: units }, { data: seen }] = await Promise.all([
    sb.from("review_queue").select("question_id").eq("user_id", user.id).lte("due_date", today).order("due_date").limit(8),
    sb.from("unit_accuracy").select("*").eq("user_id", user.id),
    admin.from("units").select("id,questions,subject").eq("exam_code", exam),
    admin.from("answers").select("question_id").eq("user_id", user.id).limit(20000),
  ]);
  const seenSet = new Set((seen ?? []).map((r) => r.question_id));
  const picked: string[] = (due ?? []).map((r) => r.question_id);

  const unitIds = (units ?? []).map((u) => u.id);
  const weak = (acc ?? [])
    .filter((a) => unitIds.includes(a.unit_id) && a.attempted >= 5)
    .sort((a, b) => a.correct / a.attempted - b.correct / b.attempted)
    .slice(0, 3)
    .map((a) => a.unit_id);
  const untouched = unitIds.filter((id) => !(acc ?? []).some((a) => a.unit_id === id));
  const focus = [...weak, ...shuffle(untouched).slice(0, 3 - Math.min(weak.length, 3))];

  const take = async (unitId: string | null, n: number, ca = false) => {
    let q = admin.from("questions").select("id").eq("status", "active").limit(300);
    q = ca ? q.eq("origin", "ca").gte("ca_date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)) : q.eq("unit_id", unitId!);
    const { data } = await q;
    const pool = shuffle((data ?? []).map((r) => r.id).filter((id) => !seenSet.has(id) && !picked.includes(id)));
    picked.push(...pool.slice(0, n));
  };
  for (const u of focus) await take(u, 3);
  await take(null, 3, true);
  for (const u of shuffle(unitIds.filter((id) => !(units ?? []).find((x) => x.id === id && (x.subject === "aptitude" || x.subject === "reasoning")) || Math.random() < 0.3))) {
    if (picked.length >= 20) break;
    await take(u, 1);
  }
  const ids = picked.slice(0, 20);
  if (!ids.length) return fail("வினா வங்கியில் இன்னும் வினாக்கள் இல்லை");
  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "daily", exam_code: exam, title: `இன்றைய பயிற்சி – ${today}`, question_ids: ids, duration_sec: ids.length * 54 })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}` });
});
