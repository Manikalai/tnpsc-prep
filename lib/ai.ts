// AI router: tries each configured provider in order and returns parsed JSON.
// Gemini (free tier) first, then Groq, then OpenRouter ":free" models.
import { serverEnv } from "./env";

export type GenOpts = {
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

async function callGemini(o: GenOpts): Promise<string> {
  const env = serverEnv();
  if (!env.geminiKey) throw new Error("GEMINI_API_KEY missing");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: o.system }] },
        contents: [{ role: "user", parts: [{ text: o.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: o.temperature ?? 0.6,
          maxOutputTokens: o.maxTokens ?? 8192,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("gemini: empty response");
  return text;
}

async function callOpenAICompatible(url: string, key: string, model: string, o: GenOpts): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: o.temperature ?? 0.6,
      max_tokens: o.maxTokens ?? 8192,
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
  if (name === "groq") {
    if (!env.groqKey) throw new Error("GROQ_API_KEY missing");
    return callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", env.groqKey, env.groqModel, o);
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
  for (const p of order) {
    for (let i = 0; i < 2; i++) {
      try {
        const text = await callProvider(p, o);
        return { data: parseJSON(text) as T, provider: p };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push(`${p}: ${msg}`);
        if (/missing|not configured/.test(msg)) break; // no point retrying
        await sleep(i === 0 ? 1500 : 0);
      }
    }
  }
  throw new AIError("எல்லா AI சேவைகளும் தோல்வியடைந்தன (all AI providers failed)", attempts);
}

/** Gemini embeddings, 768 dimensions, batched. */
export async function embed(texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const env = serverEnv();
  if (!env.geminiKey) throw new Error("GEMINI_API_KEY missing");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiEmbedModel}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiKey },
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
