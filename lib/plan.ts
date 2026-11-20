// Day-by-day study plan up to the exam. Worked out fresh from what is still not done, so a missed day simply
// rolls forward — nothing to "catch up" by hand.
// - every syllabus topic not yet marked done is spread over the study days, heavy + weak units first
// - Sundays: full mock test + revision (no new topics)
// - the last stretch (10 days, or 20% if less time): revision + mocks only
// Syllabus (units + topics) is the same for everyone, so it is cached on the server; only her progress is read per visit.
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase/admin";

type Unit = { id: string; name_ta: string; questions: number };
type Topic = { id: string; unit_id: string; name_ta: string; sort: number };
export type PlanTopic = { id: string; name: string; unitId: string; unit: string };
export type PlanDay = { date: string; kind: "study" | "mock" | "revision"; topics: PlanTopic[] };

const syllabus = unstable_cache(
  async (exam: string) => {
    const sb = supabaseAdmin();
    const [{ data: units }, { data: ex }] = await Promise.all([
      sb.from("units").select("id,name_ta,questions").eq("exam_code", exam).order("sort"),
      sb.from("exams").select("exam_date").eq("code", exam).maybeSingle(),
    ]);
    const ids = (units ?? []).map((u) => u.id);
    const { data: topics } = ids.length ? await sb.from("topics").select("id,unit_id,name_ta,sort").in("unit_id", ids).order("sort").limit(5000) : { data: [] };
    return { units: (units ?? []) as Unit[], topics: (topics ?? []) as Topic[], examDate: (ex?.exam_date as string | null) ?? null };
  },
  ["syllabus-v1"],
  { revalidate: 3600 },
);

const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayIST = () => iso(new Date(Date.now() + 5.5 * 3600e3));

export async function buildPlan(sb: SupabaseClient, userId: string, exam: string, examDate: string | null) {
  const [{ units, topics, examDate: officialDate }, { data: prog }, { data: acc }] = await Promise.all([
    syllabus(exam),
    sb.from("progress").select("topic_id,status").eq("user_id", userId).limit(5000),
    sb.from("unit_accuracy").select("unit_id,attempted,correct").eq("user_id", userId),
  ]);
  const done = new Set((prog ?? []).filter((p) => p.status === "done" || p.status === "revised").map((p) => p.topic_id));
  const accMap = new Map((acc ?? []).map((a) => [a.unit_id, a]));
  const unitOf = new Map(units.map((u) => [u.id, u]));
  const weight = (unitId: string) => {
    const u = unitOf.get(unitId), a = accMap.get(unitId);
    const accuracy = a && a.attempted ? a.correct / a.attempted : 0.5;
    return (u?.questions ?? 1) * (1.5 - accuracy);
  };
  // heavy/weak units first; inside a unit keep the syllabus order
  const remaining = topics.filter((t) => !done.has(t.id))
    .sort((a, b) => weight(b.unit_id) - weight(a.unit_id) || a.unit_id.localeCompare(b.unit_id) || a.sort - b.sort);

  const start = new Date(`${todayIST()}T00:00:00Z`);
  examDate = examDate ?? officialDate;
  const end = examDate ? new Date(`${examDate}T00:00:00Z`) : new Date(start.getTime() + 50 * 864e5);
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5));
  const revisionDays = Math.min(10, Math.max(2, Math.round(total * 0.2)));
  const days: PlanDay[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getTime() + i * 864e5);
    const kind: PlanDay["kind"] = i >= total - revisionDays ? "revision" : d.getUTCDay() === 0 ? "mock" : "study";
    days.push({ date: iso(d), kind, topics: [] });
  }
  const study = days.filter((d) => d.kind === "study");
  const perDay = study.length ? Math.ceil(remaining.length / study.length) : 0;
  let k = 0;
  for (const d of study) for (let j = 0; j < perDay && k < remaining.length; j++, k++) {
    const t = remaining[k];
    d.topics.push({ id: t.id, name: t.name_ta, unitId: t.unit_id, unit: unitOf.get(t.unit_id)?.name_ta ?? "" });
  }
  return { examDate, days, perDay, remaining: remaining.length, total: topics.length, done: topics.length - remaining.length, revisionDays, daysLeft: total };
}
