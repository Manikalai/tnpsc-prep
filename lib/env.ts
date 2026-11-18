// Central place for environment variables. Server-only values are read lazily so the
// browser bundle never sees them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function serverEnv() {
  return {
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    providers: (process.env.AI_PROVIDERS ?? "gemini,groq,openrouter")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    geminiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-flash-latest",
    geminiEmbedModel: process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001",
    groqKey: process.env.GROQ_API_KEY ?? "",
    groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    openrouterKey: process.env.OPENROUTER_API_KEY ?? "",
    openrouterModels: (process.env.OPENROUTER_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export function isAllowed(email?: string | null) {
  const list = serverEnv().allowedEmails;
  if (list.length === 0) return true; // not configured yet: allow (README tells you to set it)
  return !!email && list.includes(email.toLowerCase());
}
