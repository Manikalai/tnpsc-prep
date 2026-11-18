// Scores a test taken offline (same rules as the server: 1.5 marks per question in mocks, Group 4 Tamil gate).
export type OQ = { id: string; unit_id: string | null; chapter_id: number | null; stem: string; options: string[]; answer_index: number; explanation: string | null; source_ref: string | null; origin: string; difficulty: string | null; pyq_year: number | null; ca_date: string | null; verified: string | null; exam_code: string | null };
export type Unit = { id: string; part_id: string; name_ta: string };
export type Part = { id: string; name_ta: string; gate_min_marks: number | null };
export type Result = {
  title: string; correct: number; total: number; marks: number; max: number; gatePassed: boolean | null;
  parts: { name: string; correct: number; total: number; marks: number }[];
  units: { name: string; correct: number; total: number }[];
  review: { q: OQ; chosen: number | null }[];
};

export function scoreLocal(title: string, qs: OQ[], answers: Record<string, number | null>, opts: { mock: boolean; markPerQ: number; units: Unit[]; parts: Part[] }): Result {
  const mark = opts.mock ? opts.markPerQ : 1;
  const unitById = new Map(opts.units.map((u) => [u.id, u]));
  const ps = new Map<string, { correct: number; total: number }>();
  const us = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  for (const q of qs) {
    const ok = answers[q.id] === q.answer_index;
    if (ok) correct++;
    const uk = q.unit_id ?? "other";
    const u = us.get(uk) ?? { correct: 0, total: 0 };
    u.total++; if (ok) u.correct++; us.set(uk, u);
    const pk = (q.unit_id && unitById.get(q.unit_id)?.part_id) || "other";
    const p = ps.get(pk) ?? { correct: 0, total: 0 };
    p.total++; if (ok) p.correct++; ps.set(pk, p);
  }
  let gatePassed: boolean | null = null;
  const parts = opts.mock
    ? opts.parts.filter((p) => ps.has(p.id)).map((p) => {
        const s = ps.get(p.id)!;
        if (p.gate_min_marks != null) gatePassed = s.correct * mark >= Number(p.gate_min_marks);
        return { name: p.name_ta, ...s, marks: s.correct * mark };
      })
    : [];
  return {
    title, correct, total: qs.length, marks: correct * mark, max: qs.length * mark, gatePassed, parts,
    units: [...us.entries()].map(([id, s]) => ({ name: unitById.get(id)?.name_ta ?? "பிற", ...s })),
    review: qs.map((q) => ({ q, chosen: answers[q.id] ?? null })),
  };
}

export const paperNo = (ref: string | null) => Number(ref?.match(/வினா\s*(\d+)/)?.[1] ?? 9999);
