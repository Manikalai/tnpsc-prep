// Makes short Sarvam (Bulbul) Tamil voice samples so we can compare voices before switching Listen to them.
import "./env";
import { mkdirSync, writeFileSync } from "node:fs";
const key = process.env.SARVAM_API_KEY!;
const text = "விசை என்பது ஒரு பொருளின் மீது செயல்படும் தள்ளுதல் அல்லது இழுத்தல் ஆகும். விசை, ஓய்வில் உள்ள பொருளை இயக்கத்திற்குக் கொண்டு வரும்; இயங்கும் பொருளின் வேகத்தையும் திசையையும் மாற்றும். வேகம் என்பது கடந்த தொலைவை எடுத்துக்கொண்ட காலத்தால் வகுப்பதாகும். உசைன் போல்ட் 100 மீட்டர் தூரத்தை 9.58 விநாடிகளில் ஓடி உலக சாதனை படைத்தார்.";
mkdirSync("samples", { recursive: true });
const tries: [string, string][] = (process.env.VOICES || "bulbul:v3/kavitha,bulbul:v3/priya,bulbul:v3/shruti,bulbul:v3/roopa,bulbul:v3/ritu,bulbul:v3/mani").split(",").map((x) => x.split("/") as [string, string]);
for (const [model, speaker] of tries) {
  const r = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST", headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language_code: "ta-IN", model, speaker, output_audio_codec: "mp3", speech_sample_rate: 24000 }),
  });
  const j = await r.json() as { audios?: string[] };
  if (!r.ok || !j.audios?.[0]) { console.log(`${model} ${speaker}: FAILED ${r.status} ${JSON.stringify(j).slice(0, 200)}`); continue; }
  writeFileSync(`samples/${model.replace(/\W/g, "")}-${speaker}.mp3`, Buffer.from(j.audios.join(""), "base64"));
  console.log(`${model} ${speaker}: ok`);
}
