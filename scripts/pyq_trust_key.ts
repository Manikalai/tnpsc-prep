// Past-paper questions held back ONLY because an AI's own answer differed from TNPSC's official key:
// the official key decides, so they are made active again (the AI note is kept for reference).
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
const admin = supabaseAdmin();
const year = Number(process.env.PYQ_YEAR), exam = process.env.PYQ_EXAM || "G4";
const { data } = await admin.from("questions").select("id,verify_note").eq("origin", "pyq").eq("exam_code", exam).eq("pyq_year", year).eq("status", "flagged");
const only = (data ?? []).filter((q) => /^AI would answer [A-D]$/.test(String(q.verify_note ?? "").trim()));
for (const q of only) await admin.from("questions").update({ status: "active", verified: "ok", verify_note: `TNPSC official key (an AI had guessed ${String(q.verify_note).slice(-1)})` }).eq("id", q.id);
console.log(`${exam} ${year}: ${data?.length ?? 0} held back · ${only.length} made active (official key decides) · ${(data?.length ?? 0) - only.length} still held back`);
