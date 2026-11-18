import { route, ok } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreTest, updateReview } from "@/lib/exam";

type Attempt = {
  localId: string; kind: string; exam_code: string | null; unit_id: string | null; title: string;
  question_ids: string[]; answers: Record<string, number | null>; times?: Record<string, number>;
  started_at: string; duration_sec: number; elapsedSec: number;
};

// Uploads tests taken offline: re-scored on the server, answers saved, revision list updated.
export const POST = route<{ attempts: Attempt[] }>(async ({ sb, user }, b) => {
  const admin = supabaseAdmin();
  const synced: string[] = [];
  for (const a of (b.attempts ?? []).slice(0, 50)) {
    const { data: dup } = await sb.from("tests").select("id").eq("user_id", user.id).contains("result", { localId: a.localId }).limit(1);
    if (dup?.length) { synced.push(a.localId); continue; }
    const { data: existing } = await admin.from("questions").select("id").in("id", a.question_ids);
    const ids = a.question_ids.filter((id) => existing?.some((e) => e.id === id)); // questions deleted since download are dropped
    if (!ids.length) { synced.push(a.localId); continue; }
    const test = { exam_code: a.exam_code, question_ids: ids, kind: a.kind };
    const s = await scoreTest(admin, test, a.answers);
    const { data: row, error } = await sb
      .from("tests")
      .insert({
        user_id: user.id, kind: a.kind, exam_code: a.exam_code, unit_id: a.unit_id, title: `${a.title} (இணையமின்றி)`,
        question_ids: ids, duration_sec: a.duration_sec, started_at: a.started_at, submitted_at: new Date(new Date(a.started_at).getTime() + a.elapsedSec * 1000).toISOString(),
        score: s.score, max_score: s.maxScore, result: { ...s.result, elapsedSec: a.elapsedSec, localId: a.localId },
      })
      .select("id")
      .single();
    if (error || !row) continue;
    await sb.from("answers").upsert(s.answers.map((x) => ({ ...x, test_id: row.id, user_id: user.id, time_ms: a.times?.[x.question_id] ?? null })));
    await updateReview(sb, user.id, s.answers);
    synced.push(a.localId);
  }
  return ok({ synced });
});
