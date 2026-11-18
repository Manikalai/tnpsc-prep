import { route, ok, fail } from "@/lib/api";

export const POST = route<{ display_name?: string; target_exam?: string; exam_date?: string | null }>(async ({ sb, user }, b) => {
  const patch: Record<string, unknown> = {};
  if (b.display_name !== undefined) patch.display_name = b.display_name.slice(0, 60);
  if (b.target_exam && ["G1", "G2", "G4"].includes(b.target_exam)) patch.target_exam = b.target_exam;
  if (b.exam_date !== undefined) patch.exam_date = b.exam_date || null;
  const { error } = await sb.from("profiles").update(patch).eq("id", user.id);
  if (error) return fail(error.message);
  return ok({ notice: "சேமிக்கப்பட்டது" });
});
