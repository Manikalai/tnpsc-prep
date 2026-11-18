import { route, ok, fail } from "@/lib/api";
import { paperNo } from "@/lib/offline-score";

// Real paper mode: an actual TNPSC paper in its original order, timed like the exam, scored with TNPSC's answers.
export const POST = route<{ exam: string; year: number }>(async ({ sb, user }, b) => {
  const { data } = await sb.from("questions").select("id,source_ref").eq("origin", "pyq").eq("exam_code", b.exam).eq("pyq_year", b.year).eq("status", "active").limit(400);
  const rows = (data ?? []).sort((a, z) => paperNo(a.source_ref) - paperNo(z.source_ref));
  if (!rows.length) return fail("இந்த வினாத்தாள் இன்னும் சேர்க்கப்படவில்லை");
  const label: Record<string, string> = { G4: "தொகுதி IV", G2: "தொகுதி II / IIA", G1: "தொகுதி I" };
  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "mock", exam_code: b.exam, title: `TNPSC ${label[b.exam] ?? b.exam} ${b.year} – உண்மை வினாத்தாள்`, question_ids: rows.map((r) => r.id), duration_sec: Math.round(180 * 60 * (rows.length / 200)) })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}`, notice: rows.length < 200 ? `${rows.length} வினாக்கள் (சில வினாக்கள் சரிபார்ப்புக்காக நிறுத்தப்பட்டுள்ளன / ரத்து செய்யப்பட்டவை)` : undefined });
});
