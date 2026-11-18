import { route, ok, fail } from "@/lib/api";

export const POST = route<{ topicId: string; status: string }>(async ({ sb, user }, b) => {
  if (!["todo", "studying", "done", "revised"].includes(b.status)) return fail("bad status");
  const { error } = await sb.from("progress").upsert({ user_id: user.id, topic_id: b.topicId, status: b.status, updated_at: new Date().toISOString() });
  if (error) return fail(error.message);
  return ok();
});
