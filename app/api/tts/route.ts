import { createHash } from "node:crypto";
import { route, ok, fail } from "@/lib/api";
import { PICKABLE } from "@/lib/voices";

// Natural Tamil voice (Google Cloud Text-to-Speech, Chirp 3 HD) for the Listen button.
// Each piece of text is turned into audio once, saved in Supabase Storage (bucket "tts") and reused for free after that.
// Stays inside Google's free tier: past TTS_MONTHLY_LIMIT characters a month it answers {fallback:true}
// and the phone uses its own voice instead. No key set → fallback as well.
export const maxDuration = 30;

const VOICES = (process.env.GOOGLE_TTS_VOICE || "ta-IN-Chirp3-HD-Kore,ta-IN-Chirp3-HD-Aoede,ta-IN-Wavenet-A").split(",").map((v) => v.trim()).filter(Boolean);

const LIMIT = Number(process.env.TTS_MONTHLY_LIMIT || 950000);
const SB = () => ({ url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.SUPABASE_SERVICE_ROLE_KEY! });
const H = (k: string) => ({ apikey: k, Authorization: `Bearer ${k}` });

async function usedThisMonth() {
  const { url, key } = SB();
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const r = await fetch(`${url}/rest/v1/job_runs?job=eq.tts&ran_at=gte.${start.toISOString()}&select=detail&limit=20000`, { headers: H(key), cache: "no-store" });
  const rows = (await r.json().catch(() => [])) as { detail?: { chars?: number } }[];
  return Array.isArray(rows) ? rows.reduce((n, x) => n + (x.detail?.chars ?? 0), 0) : 0;
}

async function synth(text: string, gkey: string, voices: string[]): Promise<Buffer> {
  let last = "";
  for (const name of voices) {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(gkey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: "ta-IN", name }, audioConfig: { audioEncoding: "MP3" } }),
      signal: AbortSignal.timeout(25000),
    });
    if (r.ok) {
      const j = (await r.json()) as { audioContent?: string };
      if (j.audioContent) return Buffer.from(j.audioContent, "base64");
    }
    last = `${name} ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`;
    if (r.status === 403 || r.status === 401) break; // key problem: other voices won't help
  }
  throw new Error(last);
}

export const POST = route<{ text: string; voice?: string }>(async (_ctx, b) => {
  const gkey = process.env.GOOGLE_TTS_KEY;
  const text = (b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
  if (!text) return fail("no text");
  if (!gkey) return ok({ fallback: true, reason: "no key" });
  const { url, key } = SB();
  const chosen = b.voice && (PICKABLE as readonly string[]).includes(b.voice) ? `ta-IN-Chirp3-HD-${b.voice}` : null;
  const voices = chosen ? [chosen, ...VOICES.filter((v) => v !== chosen)] : VOICES;
  const hash = createHash("sha1").update(`${voices[0]}|${text}`).digest("hex");
  const pub = `${url}/storage/v1/object/public/tts/${hash.slice(0, 2)}/${hash}.mp3`;
  // already made once → reuse
  const head = await fetch(pub, { method: "HEAD", cache: "no-store" }).catch(() => null);
  if (head?.ok) return ok({ url: pub });
  if ((await usedThisMonth()) + text.length > LIMIT) return ok({ fallback: true, reason: "monthly free limit reached" });
  let audio: Buffer;
  try { audio = await synth(text, gkey, voices); } catch (e) { console.error("tts", e); return ok({ fallback: true, reason: "voice service error" }); }
  const put = () => fetch(`${url}/storage/v1/object/tts/${hash.slice(0, 2)}/${hash}.mp3`, {
    method: "POST", headers: { ...H(key), "Content-Type": "audio/mpeg", "x-upsert": "true", "Cache-Control": "max-age=31536000" }, body: new Uint8Array(audio),
  });
  let up = await put();
  if (up.status === 404 || up.status === 400) {
    // first time: create the public "tts" bucket
    await fetch(`${url}/storage/v1/bucket`, { method: "POST", headers: { ...H(key), "Content-Type": "application/json" }, body: JSON.stringify({ id: "tts", name: "tts", public: true }) });
    up = await put();
  }
  await fetch(`${url}/rest/v1/job_runs`, { method: "POST", headers: { ...H(key), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ job: "tts", ok: up.ok, detail: { chars: text.length } }) });
  if (!up.ok) return ok({ audio: audio.toString("base64") }); // play it anyway
  return ok({ url: pub });
});
