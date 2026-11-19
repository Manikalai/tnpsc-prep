import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateChapterMCQs, generateChapterNote, generateCleanPart, NOTE_KINDS, type Chapter, type NoteKind, type Revision } from "@/lib/chapters";
import { shuffle } from "@/lib/questions";
import { generateBookBack } from "@/lib/bookback";

export const maxDuration = 60;

export const POST = route<{ action: "notes" | "quiz" | "cards" | "clean" | "bookback"; chapterId: number; kind?: NoteKind; part?: number }>(async ({ sb, user }, b) => {
  const admin = supabaseAdmin();
  const { data: ch } = await admin.from("chapters").select("*").eq("id", b.chapterId).single();
  if (!ch) return fail("பாடம் கிடைக்கவில்லை");
  const chapter = ch as Chapter;

  if (b.action === "notes") {
    if (!b.kind || !NOTE_KINDS.includes(b.kind)) return fail("bad kind");
    await generateChapterNote(admin, chapter, b.kind, 50000);
    return ok();
  }

  if (b.action === "bookback") {
    return ok(await generateBookBack(admin, chapter, 55000));
  }

  if (b.action === "clean") {
    return ok(await generateCleanPart(admin, chapter, Math.max(0, Number(b.part) || 0), 52000));
  }

  if (b.action === "cards") {
    const { data: n } = await admin.from("chapter_notes").select("content").eq("chapter_id", chapter.id).eq("kind", "revision").single();
    const items = (n?.content as Revision | undefined)?.items ?? [];
    if (!items.length) return fail("முதலில் திருப்புதல் வினாக்களை உருவாக்கவும்");
    await sb.from("flashcards").insert(items.map((i) => ({ user_id: user.id, front: i.q, back: i.a })));
    return ok({ notice: `${items.length} அட்டைகள் சேர்க்கப்பட்டன` });
  }

  // quiz: chapter bank first, then a small timed AI batch
  const [{ data: bank }, { data: seen }] = await Promise.all([
    admin.from("questions").select("id").eq("chapter_id", chapter.id).eq("status", "active").limit(500),
    admin.from("answers").select("question_id").eq("user_id", user.id).limit(20000),
  ]);
  const seenSet = new Set((seen ?? []).map((r) => r.question_id));
  const all = (bank ?? []).map((r) => r.id);
  let ids = [...shuffle(all.filter((id) => !seenSet.has(id))), ...shuffle(all.filter((id) => seenSet.has(id)))].slice(0, 15);
  let notice: string | undefined;
  if (ids.filter((id) => !seenSet.has(id)).length < 10) {
    try {
      const fresh = await generateChapterMCQs(admin, chapter, 8, 45000);
      ids = [...fresh, ...ids.filter((id) => !fresh.includes(id))].slice(0, 15);
    } catch {
      if (!ids.length) return fail("AI இப்போது மெதுவாக உள்ளது. சிறிது நேரம் கழித்து முயலவும்.");
      notice = "புதிய வினாக்கள் இப்போது உருவாக்க முடியவில்லை; ஏற்கனவே உள்ளவை தரப்படுகின்றன.";
    }
  }
  if (!ids.length) return fail("வினாக்களை உருவாக்க முடியவில்லை");
  const { data: test, error } = await sb
    .from("tests")
    .insert({ user_id: user.id, kind: "quiz", title: `${chapter.book} – பாடம் ${chapter.chapter_no}: ${chapter.title_ta}`, question_ids: ids, duration_sec: ids.length * 54 })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ redirect: `/test/${test.id}`, notice });
});
