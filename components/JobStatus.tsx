// "பணிகள் நிலை": live progress of the long GitHub jobs (book loading, lesson preparation).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Progress } from "@/lib/progress";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "இப்போது" : m < 60 ? `${m} நிமி. முன்` : `${Math.round(m / 60)} மணி முன்`;
};

export default async function JobStatus({ sb }: { sb: SupabaseClient }) {
  const { data } = await sb.from("job_runs").select("job,detail,ran_at").like("job", "progress:%").order("id", { ascending: false }).limit(20);
  const latest = new Map<string, Progress>();
  for (const r of data ?? []) if (!latest.has(r.job)) latest.set(r.job, r.detail as Progress);
  if (!latest.size) return null;
  return (
    <section className="card">
      <h2 className="h2 mb-2">பணிகள் நிலை</h2>
      <div className="space-y-3">
        {[...latest.entries()].map(([job, p]) => {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          const stale = !p.finished && Date.now() - new Date(p.updated).getTime() > 15 * 60000;
          return (
            <div key={job}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold leading-snug">{p.title}</p>
                <span className={`chip shrink-0 ${p.finished ? "bg-brand-50 text-brand-700" : stale ? "bg-kumkum-50 text-kumkum-500" : "bg-gold-400/20 text-maroon-700"}`}>
                  {p.finished ? "முடிந்தது" : stale ? "நின்றுவிட்டது?" : "நடைபெறுகிறது"}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-gradient-to-r from-saffron-500 to-gold-400" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-[13px] text-stone-600">
                {p.done}/{p.total} ({pct}%){p.failed ? ` · தோல்வி ${p.failed}` : ""} · புதுப்பிப்பு {ago(p.updated)}
              </p>
              {p.current && !p.finished && <p className="text-[13px] text-stone-500">இப்போது: {p.current}</p>}
              {p.note && <p className="text-[13px] text-stone-500">{p.note}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
