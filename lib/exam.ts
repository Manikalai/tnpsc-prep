// Exam structure, mock-test assembly, scoring and spaced repetition.
import type { SupabaseClient } from "@supabase/supabase-js";
import { shuffle, type Unit } from "./questions";

export type Exam = {
  code: string;
  name_ta: string;
  total_questions: number;
  total_marks: number;
  mark_per_q: number;
  duration_min: number;
  exam_date: string | null;
  notes_ta: string | null;
};
export type Part = { id: string; exam_code: string; sort: number; name_ta: string; questions: number; gate_min_marks: number | null };
export type UnitRow = Unit & { sort: number; approx: boolean };

export async function loadExam(sb: SupabaseClient, code: string) {
  const [{ data: exam }, { data: parts }, { data: units }] = await Promise.all([
    sb.from("exams").select("*").eq("code", code).single(),
    sb.from("parts").select("*").eq("exam_code", code).order("sort"),
    sb.from("units").select("*").eq("exam_code", code).order("sort"),
  ]);
  return { exam: exam as Exam | null, parts: (parts ?? []) as Part[], units: (units ?? []) as UnitRow[] };
}

export const maxStdFor = (examCode: string) => (examCode === "G4" ? 10 : 12);

/** Pick questions for a full mock test from the question bank, unit by unit, following the blueprint. */
export async function assembleMock(admin: SupabaseClient, userId: string, code: string) {
  const { exam, parts, units } = await loadExam(admin, code);
  if (!exam) throw new Error("exam not found");
  const { data: seen } = await admin.from("answers").select("question_id").eq("user_id", userId).limit(20000);
  const seenSet = new Set((seen ?? []).map((r: { question_id: string }) => r.question_id));

  const picked: string[] = [];
  const shortage: { unit: string; have: number; need: number }[] = [];
  for (const part of parts) {
    for (const u of units.filter((x) => x.part_id === part.id)) {
      let q = admin.from("questions").select("id").eq("status", "active").limit(1000);
      if (u.subject === "current") {
        const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
        q = q.or(`unit_id.eq.${u.id},and(origin.eq.ca,ca_date.gte.${since})`);
      } else {
        q = q.eq("unit_id", u.id);
      }
      const { data } = await q;
      const ids = (data ?? []).map((r: { id: string }) => r.id);
      const fresh = shuffle(ids.filter((id) => !seenSet.has(id)));
      const old = shuffle(ids.filter((id) => seenSet.has(id)));
      const chosen = [...fresh, ...old].slice(0, u.questions);
      if (chosen.length < u.questions) shortage.push({ unit: u.name_ta, have: chosen.length, need: u.questions });
      picked.push(...chosen);
    }
  }
  return { exam, picked, shortage };
}

type QRow = { id: string; unit_id: string | null; answer_index: number };

/** Score a submitted test. Works for mocks (per part / unit, Group 4 Tamil gate) and simple quizzes. */
export async function scoreTest(
  admin: SupabaseClient,
  test: { exam_code: string | null; question_ids: string[]; kind: string },
  chosen: Record<string, number | null>
) {
  const { data } = await admin.from("questions").select("id,unit_id,answer_index").in("id", test.question_ids);
  const qs = (data ?? []) as QRow[];
  const byId = new Map(qs.map((q) => [q.id, q]));
  const markPerQ = test.kind === "mock" ? 1.5 : 1;

  let parts: Part[] = [];
  let units: UnitRow[] = [];
  if (test.exam_code) {
    const s = await loadExam(admin, test.exam_code);
    parts = s.parts;
    units = s.units;
  }
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const perUnit = new Map<string, { correct: number; total: number; attempted: number }>();
  const perPart = new Map<string, { correct: number; total: number; attempted: number }>();
  let correct = 0;
  let attempted = 0;
  const answers = test.question_ids.map((id) => {
    const q = byId.get(id);
    const c = chosen[id];
    const ok = q != null && c != null && c === q.answer_index;
    const tried = c != null && c !== 4; // 4 = (E) answer not known
    if (tried) attempted++;
    if (ok) correct++;
    const uKey = q?.unit_id ?? "ca";
    const u = perUnit.get(uKey) ?? { correct: 0, total: 0, attempted: 0 };
    u.total++;
    if (tried) u.attempted++;
    if (ok) u.correct++;
    perUnit.set(uKey, u);
    const pKey = (q?.unit_id && unitMap.get(q.unit_id)?.part_id) || "other";
    const p = perPart.get(pKey) ?? { correct: 0, total: 0, attempted: 0 };
    p.total++;
    if (tried) p.attempted++;
    if (ok) p.correct++;
    perPart.set(pKey, p);
    return { question_id: id, chosen: c ?? null, correct: ok };
  });

  let gatePassed: boolean | null = null;
  const partRows = parts.map((p) => {
    const s = perPart.get(p.id) ?? { correct: 0, total: 0, attempted: 0 };
    const marks = s.correct * markPerQ;
    if (p.gate_min_marks != null) gatePassed = marks >= Number(p.gate_min_marks);
    return { id: p.id, name: p.name_ta, ...s, marks, max: s.total * markPerQ, gate: p.gate_min_marks };
  });
  const unitRows = [...perUnit.entries()].map(([id, s]) => ({
    id,
    name: unitMap.get(id)?.name_ta ?? (id === "ca" ? "நடப்பு நிகழ்வுகள்" : id),
    ...s,
  }));

  const notKnown = test.question_ids.filter((id) => chosen[id] === 4).length;
  const blank = test.question_ids.filter((id) => chosen[id] == null).length;
  return {
    answers,
    score: correct * markPerQ,
    maxScore: test.question_ids.length * markPerQ,
    result: { correct, attempted, notKnown, blank, total: test.question_ids.length, markPerQ, parts: partRows, units: unitRows, gatePassed },
  };
}

// ───────── spaced repetition (wrong answers come back after 1, 3, 7, 15, 30, 60 days) ─────────
const STEPS = [1, 3, 7, 15, 30, 60];
const addDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export async function updateReview(
  sb: SupabaseClient,
  userId: string,
  results: { question_id: string; correct: boolean; chosen: number | null }[]
) {
  const ids = results.map((r) => r.question_id);
  const { data } = await sb.from("review_queue").select("*").eq("user_id", userId).in("question_id", ids);
  const existing = new Map((data ?? []).map((r: { question_id: string; streak: number; lapses: number }) => [r.question_id, r]));
  const upserts: Record<string, unknown>[] = [];
  const removes: string[] = [];
  for (const r of results) {
    const ex = existing.get(r.question_id);
    if (!r.correct && r.chosen != null) { // wrong, or (E) not known → revise it
      upserts.push({ user_id: userId, question_id: r.question_id, due_date: addDays(1), interval_days: 1, streak: 0, lapses: (ex?.lapses ?? 0) + 1 });
    } else if (r.correct && ex) {
      const streak = ex.streak + 1;
      if (streak >= STEPS.length) removes.push(r.question_id);
      else upserts.push({ user_id: userId, question_id: r.question_id, due_date: addDays(STEPS[streak]), interval_days: STEPS[streak], streak, lapses: ex.lapses });
    }
  }
  if (upserts.length) await sb.from("review_queue").upsert(upserts);
  if (removes.length) await sb.from("review_queue").delete().eq("user_id", userId).in("question_id", removes);
}

export const nextFlashDue = (interval: number, knew: boolean) => {
  const next = knew ? STEPS.find((s) => s > interval) ?? 60 : 1;
  return { interval_days: next, due_date: addDays(next) };
};
