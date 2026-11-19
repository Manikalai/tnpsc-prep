import { route, ok, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDaily } from "@/lib/ca";

export const maxDuration = 60;

// "இப்போதே புதுப்பி": starts the daily current-affairs job on GitHub (no 60-second limit there).
// Needs GH_DISPATCH_TOKEN (fine-grained token with "Actions: read and write" on this repo) in Vercel.
// Without the token it falls back to running here, which may hit the 60-second limit.
export const POST = route(async () => {
  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GH_REPO || "Manikalai/tnpsc-prep";
  if (token) {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/daily-current-affairs.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "saranya-prep" },
      body: JSON.stringify({ ref: "main" }),
    });
    if (r.status === 204) return ok({ notice: "புதுப்பிப்பு தொடங்கியது — சுமார் 3–5 நிமிடங்களில் புதிய குறிப்புகளும் வினாக்களும் வரும். பிறகு இந்தப் பக்கத்தைப் புதுப்பிக்கவும்." });
    return fail(`GitHub பணியைத் தொடங்க முடியவில்லை (${r.status}). Vercel-இல் GH_DISPATCH_TOKEN-ஐச் சரிபார்க்கவும்.`);
  }
  const r = await runDaily(supabaseAdmin());
  return ok({ ...r, notice: r.ok ? `${r.notes} குறிப்புகள், ${r.mcqs} வினாக்கள் சேர்க்கப்பட்டன.` : `பிழை: ${r.error}` });
});
