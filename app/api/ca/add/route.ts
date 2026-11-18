import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildCurrentAffairs, todayIST } from "@/lib/ca";

export const maxDuration = 60;

// Manually add news (e.g. a TN DIPR press release or a Government Order you read) – the AI writes the Tamil note.
export const POST = route<{ text: string; url?: string; region?: string }>(async (_ctx, b) => {
  const text = (b.text ?? "").trim();
  if (text.length < 20) return fail("செய்தியின் உரையை ஒட்டவும்");
  const r = await buildCurrentAffairs(
    supabaseAdmin(),
    [{ title: text.slice(0, 200), summary: text.slice(0, 3000), link: b.url ?? "", source: "நீங்கள் சேர்த்தது", region: b.region ?? "tn" }],
    todayIST()
  );
  return ok({ ...r, notice: r.notes ? "சேர்க்கப்பட்டது" : "தேர்வுக்குப் பயனுள்ள செய்தியாக AI கருதவில்லை" });
});
