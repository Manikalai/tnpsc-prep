// Standard: an AI-made question is shown only after it passes the answer-key check.
// Hides (status "unchecked") every active AI question not yet passed; the daily check releases them as they pass.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
const admin = supabaseAdmin();
const st = await admin.storage.from("meta").download("audit.json").then(async (r) => (r.data ? JSON.parse(await r.data.text()) : { done: {} })).catch(() => ({ done: {} }));
const ok = new Set(Object.entries(st.done as Record<string, string>).filter(([, v]) => v === "ok").map(([k]) => k));
const ids: string[] = [];
for (let f = 0; ; f += 1000) {
  const { data } = await admin.from("questions").select("id").eq("origin", "ai").eq("status", "active").order("id").range(f, f + 999);
  ids.push(...(data ?? []).map((r) => r.id));
  if (!data || data.length < 1000) break;
}
const hide = ids.filter((id) => !ok.has(id));
for (let i = 0; i < hide.length; i += 200) await admin.from("questions").update({ status: "unchecked" }).in("id", hide.slice(i, i + 200));
const count = async (o: Record<string, string>) => (await admin.from("questions").select("id", { count: "exact", head: true }).match(o)).count;
console.log(`AI questions: ${ids.length} were live · ${ok.size} already passed · ${hide.length} hidden until checked`);
console.log(`now live → past papers: ${await count({ origin: "pyq", status: "active" })} · current affairs: ${await count({ origin: "ca", status: "active" })} · AI (checked): ${await count({ origin: "ai", status: "active" })}`);
