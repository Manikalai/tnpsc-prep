// Daily current affairs job (GitHub Actions, ~6 AM IST). Also keeps the free Supabase project awake.
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { runDaily } from "../lib/ca";

const r = await runDaily(supabaseAdmin());
console.log(JSON.stringify(r, null, 2));
if (!r.ok) process.exit(1);
