// AI router: tries each configured provider in order and returns parsed JSON.
// Gemini (free tier) first, then Groq, then OpenRouter ":free" models.
import { serverEnv } from "./env";

export type GenOpts = {
  /** give up on a single provider call after this many ms (keeps web requests under Vercel's limit) */
  timeoutMs?: number;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** restrict to these providers (e.g. models that passed the Tamil quality check) */
  providers?: string[];
};

export class AIError extends Error {
  constructor(message: string, public attempts: string[]) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseJSON(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const first = Math.min(...["{", "["].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))));
  if (first > 0 && first !== Infinity) t = t.slice(first);
  return JSON.parse(t);
}

async function callGeminiModel(model: string, key: string, o: GenOpts): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: o.timeoutMs ? AbortSignal.timeout(o.timeoutMs) : undefined,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: o.system }] },
      contents: [{ role: "user", parts: [{ text: o.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: o.temperature ?? 0.6,
        maxOutputTokens: o.maxTokens ?? 8192,
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`gemini ${model}: empty response`);
  return text;
}

// key/model pairs whose free DAILY limit is used up — skipped for the rest of this run
const exhausted = new Set<string>();

/** Tries each Gemini key, and each model with it (busy / rate-limited / used up → next one). */
async function callGemini(o: GenOpts): Promise<string> {
  const env = serverEnv();
  if (!env.geminiKeys.length) throw new Error("GEMINI_API_KEY missing");
  const errs: string[] = [];
  for (const [k, key] of env.geminiKeys.entries()) {
    for (const m of env.geminiModels) {
      const id = `${k}:${m}`;
      if (exhausted.has(id)) continue;
      try {
        return await callGeminiModel(m, key, o);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/ 429:/.test(msg) && /PerDay|per day|daily/i.test(msg)) exhausted.add(id);
        if (/ 404:/.test(msg)) exhausted.add(id);
        errs.push(`key${k + 1} ${msg}`);
      }
    }
  }
  throw new Error(errs.slice(-4).join(" | "));
}

async function callOpenAICompatible(url: string, key: string, model: string, o: GenOpts, extra: Record<string, unknown> = {}, maxTokensCap = Infinity): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    signal: o.timeoutMs ? AbortSignal.timeout(o.timeoutMs) : undefined,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      ...extra,
      model,
      temperature: o.temperature ?? 0.6,
      max_tokens: Math.min(o.maxTokens ?? 8192, maxTokensCap),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${model}: empty response`);
  return text;
}

async function callProvider(name: string, o: GenOpts): Promise<string> {
  const env = serverEnv();
  if (name === "gemini") return callGemini(o);
  if (name === "sarvam") {
    // Sarvam AI (Indian-language models), OpenAI-compatible; thinking off so all tokens go to the answer
    if (!env.sarvamKey) throw new Error("SARVAM_API_KEY missing");
    return callOpenAICompatible("https://api.sarvam.ai/v1/chat/completions", env.sarvamKey, env.sarvamModel, o, { reasoning_effort: null }, env.sarvamMaxTokens);
  }
  if (name === "groq") {
    if (!env.groqKey) throw new Error("GROQ_API_KEY missing");
    let last: unknown;
    for (const m of env.groqModels) {
      if (exhausted.has(`groq:${m}`)) continue;
      try {
        return await callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", env.groqKey, m, o);
      } catch (e) {
        last = e;
        if (/ 404:| 400: .*decommission|model_not_found/i.test(String(e))) exhausted.add(`groq:${m}`);
      }
    }
    throw last;
  }
  if (name === "openrouter") {
    if (!env.openrouterKey || env.openrouterModels.length === 0) throw new Error("OpenRouter not configured");
    let last: unknown;
    for (const m of env.openrouterModels) {
      try {
        return await callOpenAICompatible("https://openrouter.ai/api/v1/chat/completions", env.openrouterKey, m, o);
      } catch (e) {
        last = e;
      }
    }
    throw last;
  }
  throw new Error(`unknown provider ${name}`);
}

/** Generate and parse a JSON object. Retries once per provider, then falls through to the next. */
export async function generateJSON<T = unknown>(o: GenOpts): Promise<{ data: T; provider: string }> {
  const order = o.providers ?? serverEnv().providers;
  const attempts: string[] = [];
  const deadline = o.timeoutMs ? Date.now() + o.timeoutMs : Infinity;
  for (const p of order) {
    if (exhausted.has(`provider:${p}`)) continue;
    for (let i = 0; i < 2; i++) {
      if (Date.now() > deadline - 5000) break;
      try {
        const text = await callProvider(p, o);
        return { data: parseJSON(text) as T, provider: p };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push(`${p}: ${msg}`);
        if (/missing|not configured/.test(msg)) break; // no point retrying
        if (/ 402:|insufficient_quota|No credits/i.test(msg)) { exhausted.add(`provider:${p}`); break; } // out of credits: skip for the rest of the run
        await sleep(i === 0 ? 1500 : 0);
      }
    }
  }
  throw new AIError("எல்லா AI சேவைகளும் தோல்வியடைந்தன (all AI providers failed)", attempts);
}

/** Gemini embeddings, 768 dimensions, batched. */
export async function embed(texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const env = serverEnv();
  if (!env.geminiKeys.length) throw new Error("GEMINI_API_KEY missing");
  let lastErr: unknown;
  for (const key of env.geminiKeys) {
    try {
      return await embedWith(key, texts, task);
    } catch (e) {
      lastErr = e;
      if (!/ 429/.test(String(e))) throw e;
    }
  }
  throw lastErr;
}

async function embedWith(key: string, texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const env = serverEnv();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiEmbedModel}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          requests: batch.map((t) => ({
            model: `models/${env.geminiEmbedModel}`,
            content: { parts: [{ text: t }] },
            taskType: task,
            outputDimensionality: 768,
          })),
        }),
      }
    );
    if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    for (const e of data.embeddings ?? []) out.push(e.values);
  }
  return out;
}

export const TAMIL_RE = /[஀-௿]/;
export const tamilRatio = (s: string) => {
  const letters = s.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters.length) return 0;
  return (letters.match(/[஀-௿]/g)?.length ?? 0) / letters.length;
};

/** Setup check: one tiny Tamil request to every configured key/provider. Never returns key values. */
export async function pingProviders() {
  const env = serverEnv();
  const o: GenOpts = { system: 'Reply as JSON {"word": "..."}', user: "Reply with the single Tamil word for hello (வணக்கம்).", temperature: 0, maxTokens: 64, timeoutMs: 25000 };
  const out: Record<string, string> = {};
  const show = async (name: string, f: () => Promise<string>) => {
    try {
      out[name] = `ok: ${(await f()).replace(/\s+/g, " ").slice(0, 40)}`;
    } catch (e) {
      out[name] = `ERROR: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`;
    }
  };
  for (const [k, key] of env.geminiKeys.entries()) {
    for (const m of env.geminiModels.slice(0, 2)) await show(`gemini key${k + 1} ${m}`, () => callGeminiModel(m, key, o));
  }
  if (!env.geminiKeys.length) out.gemini = "not set";
  out.gemini_key_2 = env.geminiKeys.length > 1 ? "set" : "NOT SET";
  if (env.sarvamKey) await show(`sarvam ${env.sarvamModel}`, () => callProvider("sarvam", o));
  else out.sarvam = "NOT SET";
  if (env.groqKey) {
    for (const m of env.groqModels)
      await show(`groq ${m}`, () => callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", env.groqKey, m, { ...o, maxTokens: 1024 }));
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${env.groqKey}` }, signal: AbortSignal.timeout(15000) });
      const j = (await r.json()) as { data?: { id: string }[] };
      out.groq_models_available = (j.data ?? []).map((x) => x.id).sort().join(", ");
    } catch (e) {
      out.groq_models_available = `ERROR: ${String(e).slice(0, 80)}`;
    }
  }
  out.order = env.providers.join(" → ");
  return out;
}
