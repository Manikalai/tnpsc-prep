import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiUser } from "@/lib/supabase/server";

// Setup check: open /api/health while logged in. Shows which settings work, never the key values.
export async function GET() {
  const ctx = await apiUser();
  if (!ctx) return NextResponse.json({ error: "login first" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const out: Record<string, unknown> = {
    service_key_set: !!key,
    service_key_kind: key.startsWith("sb_secret_") ? "secret (new)" : key.startsWith("sb_publishable_") ? "PUBLISHABLE – wrong key!" : key.startsWith("eyJ") ? "JWT (legacy)" : key ? "unknown format" : "missing",
    service_key_has_spaces: /\s/.test(key),
    service_key_same_as_anon: !!key && key === anon,
    gemini_key_set: !!process.env.GEMINI_API_KEY,
  };
  if (key.startsWith("eyJ")) {
    try {
      out.service_key_role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
    } catch {
      out.service_key_role = "unreadable";
    }
  }
  try {
    const admin = createClient(url, key.trim(), { auth: { persistSession: false } });
    const { count, error } = await admin.from("units").select("*", { count: "exact", head: true });
    out.server_db_read = error ? `ERROR: ${error.message}` : `ok, ${count} units`;
  } catch (e) {
    out.server_db_read = `ERROR: ${e instanceof Error ? e.message : e}`;
  }
  // Gemini: which models this key can use, and whether the configured one answers
  const gkey = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  out.gemini_model_configured = model;
  out.gemini_key_has_spaces = /\s/.test(gkey);
  if (gkey) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": gkey.trim() } });
      const j = await r.json();
      if (!r.ok) out.gemini_models = `ERROR ${r.status}: ${JSON.stringify(j).slice(0, 300)}`;
      else
        out.gemini_models = (j.models ?? [])
          .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: { name: string }) => m.name.replace("models/", ""))
          .filter((n: string) => /flash|gemma/.test(n));
      const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gkey.trim() },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single Tamil word: வணக்கம்" }] }] }),
      });
      const gj = await g.json();
      out.gemini_test = g.ok ? `ok: ${gj?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""}`.slice(0, 80) : `ERROR ${g.status}: ${JSON.stringify(gj?.error ?? gj).slice(0, 400)}`;
    } catch (e) {
      out.gemini_test = `ERROR: ${e instanceof Error ? e.message : e}`;
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
