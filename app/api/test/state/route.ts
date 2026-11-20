import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Pause / resume / discard an unsubmitted test.
// pause: remembers the time left (tests.result = {paused_left}); the clock stops.
// resume: moves started_at so exactly that time is left again.
// discard: deletes the test (never counts anywhere).
export const POST = route<{ testId: string; action: "pause" | "resume" | "discard"; left?: number }>(async ({ user }, b) => {
  const admin = supabaseAdmin();
  const { data: t } = await admin.from("tests").select("id,duration_sec,submitted_at,result").eq("id", b.testId).eq("user_id", user.id).maybeSingle();
  if (!t) return fail("test not found", 404);
  if (t.submitted_at) return fail("already submitted");
  if (b.action === "discard") {
    await admin.from("tests").delete().eq("id", t.id).eq("user_id", user.id);
    return ok({ redirect: "/" });
  }
  const dur = t.duration_sec ?? 0;
  if (b.action === "pause") {
    const left = Math.max(0, Math.min(dur, Math.round(Number(b.left) || 0)));
    await admin.from("tests").update({ result: { paused_left: left } }).eq("id", t.id);
    return ok({ left });
  }
  if (b.action === "resume") {
    const left = (t.result as { paused_left?: number } | null)?.paused_left;
    if (left == null) return ok({});
    const startedAt = new Date(Date.now() - (dur - left) * 1000).toISOString();
    await admin.from("tests").update({ result: null, started_at: startedAt }).eq("id", t.id);
    return ok({ startedAt });
  }
  return fail("bad action");
});
