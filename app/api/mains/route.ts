import { route, ok, fail } from "@/lib/api";
import { generateJSON } from "@/lib/ai";
import { G1_MAINS } from "@/data/syllabus";

export const maxDuration = 60;

export const POST = route<{ action: "question" | "evaluate"; paper?: number; unit?: number; question?: string; answer?: string; marks?: number }>(
  async (_ctx, b) => {
    if (b.action === "question") {
      const p = G1_MAINS[b.paper ?? 0];
      const u = p?.units[b.unit ?? 0];
      if (!p || !u) return fail("தாள்/அலகு தவறு");
      const { data } = await generateJSON<{ question: string; marks: number; words: number }>({
        system: `You set TNPSC Group 1 Mains descriptive questions in Tamil. Give one question typical of the exam for the unit, with marks (10 or 15) and expected word count (150 or 250). Return JSON {"question":"","marks":10,"words":150}`,
        user: `${p.paper} — ${u}`,
        temperature: 0.9,
      });
      return ok(data);
    }
    const answer = (b.answer ?? "").trim();
    if (answer.length < 40) return fail("விடை மிகவும் சுருக்கமாக உள்ளது");
    const { data } = await generateJSON<{ score: number; strengths: string[]; improve: string[]; missing_points: string[]; model_outline: string }>({
      system: `You are a strict TNPSC Group 1 Mains examiner. Evaluate the candidate's Tamil answer. Judge content accuracy, coverage, structure (introduction, body, conclusion), use of data/examples, Tamil Nadu relevance, and language. Do not invent facts.
Return JSON {"score":0,"strengths":[""],"improve":[""],"missing_points":[""],"model_outline":"markdown outline in Tamil"} where score is out of the given marks. Write all feedback in Tamil.`,
      user: `மதிப்பெண்: ${b.marks ?? 10}\nவினா: ${b.question}\n\nவிடை:\n${answer.slice(0, 6000)}`,
      temperature: 0.2,
    });
    return ok(data);
  }
);
