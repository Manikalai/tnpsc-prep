import { route, ok } from "@/lib/api";
import { nextFlashDue } from "@/lib/exam";

export const POST = route<{ action: "grade" | "add" | "delete"; id?: string; knew?: boolean; interval?: number; front?: string; back?: string }>(
  async ({ sb, user }, b) => {
    if (b.action === "grade") {
      await sb.from("flashcards").update(nextFlashDue(b.interval ?? 1, !!b.knew)).eq("id", b.id!).eq("user_id", user.id);
    } else if (b.action === "add" && b.front && b.back) {
      await sb.from("flashcards").insert({ user_id: user.id, front: b.front.slice(0, 500), back: b.back.slice(0, 1000) });
    } else if (b.action === "delete") {
      await sb.from("flashcards").delete().eq("id", b.id!).eq("user_id", user.id);
    }
    return ok();
  }
);
