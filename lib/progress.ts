// Live progress of long GitHub jobs, shown in the app (வினா வங்கி → பணிகள் நிலை).
// One job_runs row per run, job = "progress:<name>", updated as the job goes.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Progress = { title: string; done: number; total: number; current?: string; failed?: number; note?: string; finished?: boolean; started: string; updated: string };

export async function startProgress(admin: SupabaseClient, name: string, title: string, total: number) {
  const now = new Date().toISOString();
  const { data } = await admin.from("job_runs").insert({ job: `progress:${name}`, ok: true, detail: { title, done: 0, total, started: now, updated: now } }).select("id").single();
  const id = data?.id as number | undefined;
  let state: Progress = { title, done: 0, total, started: now, updated: now };
  let last = 0;
  return {
    async update(p: Partial<Progress>, force = false) {
      state = { ...state, ...p, updated: new Date().toISOString() };
      if (!id || (!force && Date.now() - last < 20000)) return; // at most every 20 s
      last = Date.now();
      await admin.from("job_runs").update({ detail: state, ok: !p.note?.startsWith("ERROR") }).eq("id", id);
    },
  };
}
