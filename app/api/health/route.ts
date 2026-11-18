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
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
