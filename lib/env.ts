// Central place for environment variables. Server-only values are read lazily so the
// browser bundle never sees them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function serverEnv() {
  const sarvamKey = (process.env.SARVAM_API_KEY ?? "").trim();
  let providers = (process.env.AI_PROVIDERS || "gemini,sarvam,groq,openrouter").split(",").map((p) => p.trim()).filter(Boolean);
  // Sarvam (good Tamil) goes right after Gemini whenever its key is set
  if (sarvamKey && !providers.includes("sarvam")) providers.splice(providers.indexOf("gemini") + 1, 0, "sarvam");
  return {
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    providers,
    geminiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
    /** several Gemini keys (separate projects = separate free daily limits); used in turn */
    geminiKeys: [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].map((k) => (k ?? "").trim()).filter(Boolean),
    sarvamKey,
    sarvamModel: process.env.SARVAM_MODEL || "sarvam-105b",
    sarvamMaxTokens: Number(process.env.SARVAM_MAX_TOKENS || 4096),
    geminiModels: (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash,gemini-3.5-flash-lite")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    geminiEmbedModel: process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001",
    groqKey: (process.env.GROQ_API_KEY ?? "").trim(),
    groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    openrouterKey: (process.env.OPENROUTER_API_KEY ?? "").trim(),
    openrouterModels: (process.env.OPENROUTER_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export function isAllowed(email?: string | null) {
  const list = serverEnv().allowedEmails;
  if (list.length === 0) return true; // not configured yet: allow (README tells you to set it)
  return !!email && list.includes(email.toLowerCase());
}
