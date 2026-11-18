import { route, ok } from "@/lib/api";

// Saves an aptitude drill result (questions are generated in the browser by code).
export const POST = route<{ title: string; correct: number; total: number; seconds: number; types: string[] }>(async ({ sb, user }, b) => {
  await sb.from("tests").insert({
    user_id: user.id,
    kind: "aptitude",
    title: b.title,
    question_ids: [],
    submitted_at: new Date().toISOString(),
    score: b.correct,
    max_score: b.total,
    result: { correct: b.correct, total: b.total, elapsedSec: b.seconds, types: b.types },
  });
  return ok();
});
