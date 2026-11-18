import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyChapters, DIFFICULTY, generateChapterMCQs, type Chapter } from "@/lib/chapters";
import { shuffle } from "@/lib/questions";

export const maxDuration = 60;

// Custom quiz: chosen chapters × number × difficulty. Bank first; tops up with a short, timed AI batch.
export const POST = route<{ action?: "classify"; chapterIds?: number[]; count?: number; difficulty?: string; title?: string }>(async ({ sb, user }, b) => {
  const admin = supabaseAdmin();
  if (b.action === "classify") {
    const n = await classifyChapters(admin, 6);
    return ok({ notice: `${n} பாடங்கள் வகைப்படுத்தப்பட்டன` });
  }
  const ids = (b.chapterIds ?? []).map(Number).filter(Boolean).slice(0, 200);
  if (!ids.length) return fail("குறைந்தது ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்");
  const count = [10, 15, 25, 50].includes(Number(b.count)) ? Number(b.count) : 15;
  const difficulty = b.difficulty && DIFFICULTY[b.difficulty] ? b.difficulty : "mixed";

  let q = admin.from("questions").select("id,chapter_id").in("chapter_id", ids).eq("status", "active").limit(3000);
  if (difficulty !== "mixed") q = q.eq("difficulty", difficulty);
  const [{ data: bank }, { data: seen }] = await Promise.all([q, admin.from("answers").select("question_id").eq("user_id", user.id).limit(20000)]);
  const seenSet = new Set((seen ?? []).map((r) => r.question_id));

  // spread across the chosen chapters: round-robin, unseen first
  const per = new Map<number, string[]>();
  for (const r of shuffle(bank ?? [])) per.set(r.chapter_id, [...(per.get(r.chapter_id) ?? []), r.id]);
  for (const [k, v] of per) per.set(k, [...v.filter((x) => !seenSet.has(x)), ...v.filter((x) => seenSet.has(x))]);
  const picked: string[] = [];
  let progress = true;
  while (picked.length < count && progress) {
    progress = false;
    for (const id of shuffle(ids)) {
      const next = per.get(id)?.shift();
      if (next) { picked.push(next); progress = true; }
      if (picked.length >= count) break;
    }
  }

  let notice: string | undefined;
  const freshCount = picked.filter((x) => !seenSet.has(x)).length;
  if (freshCount < count) {
    // top up from the chapter with the fewest questions (one AI call keeps us inside Vercel's 60 s)
    const counts = ids.map((id) => ({ id, n: (bank ?? []).filter((r) => r.chapter_id === id).length })).sort((a, b) => a.n - b.n);
    const { data: ch } = await admin.from("chapters").select("*").eq("id", counts[0].id).single();
    if (ch) {
      try {
        const fresh = await generateChapterMCQs(admin, ch as Chapter, Math.min(count - freshCount, 8), 45000, difficulty);
        picked.unshift(...fresh);
      } catch {
        notice = "AI இப்போது மெதுவாக உள்ளது; வங்கியில் உள்ள வினாக்கள் மட்டும் தரப்படுகின்றன.";
      }
    }
  }
  const final = shuffle([...new Set(picked)]).slice(0, count);
  if (!final.length) return fail("இந்தப் பாடங்களுக்கு இன்னும் வினாக்கள் இல்லை. சிறிது நேரம் கழித்து முயலவும்.");
  if (final.length < count)
    notice = (notice ? notice + " " : "") + `இப்போது ${final.length} வினாக்கள் தயார். மீண்டும் உருவாக்கினால் மேலும் சேரும்; இரவுப் பணியும் வங்கியை நிரப்பும்.`;

  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "quiz", title: (b.title ?? "தனிப்பயன் வினாத்தாள்").slice(0, 200), question_ids: final, duration_sec: final.length * 54 })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}`, notice });
});
