import { route, ok } from "@/lib/api";
import { nextFlashDue } from "@/lib/exam";

export const POST = route<{ action: "grade" | "add" | "delete" | "addMany"; id?: string; knew?: boolean; interval?: number; front?: string; back?: string; cards?: { front: string; back: string }[] }>(
  async ({ sb, user }, b) => {
    if (b.action === "grade") {
      await sb.from("flashcards").update(nextFlashDue(b.interval ?? 1, !!b.knew)).eq("id", b.id!).eq("user_id", user.id);
    } else if (b.action === "add" && b.front && b.back) {
      await sb.from("flashcards").insert({ user_id: user.id, front: b.front.slice(0, 500), back: b.back.slice(0, 1000) });
    } else if (b.action === "addMany" && b.cards?.length) {
      const { data: have } = await sb.from("flashcards").select("front").eq("user_id", user.id).limit(5000);
      const seen = new Set((have ?? []).map((r) => r.front));
      const rows = b.cards.filter((c) => c.front && c.back && !seen.has(c.front.slice(0, 500))).slice(0, 200)
        .map((c) => ({ user_id: user.id, front: c.front.slice(0, 500), back: c.back.slice(0, 1000) }));
      if (rows.length) await sb.from("flashcards").insert(rows);
      return ok({ notice: rows.length ? `${rows.length} அட்டைகள் சேர்க்கப்பட்டன` : "இவை ஏற்கனவே உங்கள் அட்டைகளில் உள்ளன" });
    } else if (b.action === "delete") {
      await sb.from("flashcards").delete().eq("id", b.id!).eq("user_id", user.id);
    }
    return ok();
  }
);
