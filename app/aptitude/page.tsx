import Link from "next/link";
import { APT_TOPICS } from "@/lib/aptitude-topics";
import { requireUser } from "@/lib/supabase/server";
import AptitudeDrill from "@/components/AptitudeDrill";

export const dynamic = "force-dynamic";

export default async function Aptitude() {
  const { sb, user } = await requireUser();
  const [{ data: past }, { data: pyq }] = await Promise.all([
    sb.from("tests").select("score,max_score,result").eq("user_id", user.id).eq("kind", "aptitude").order("submitted_at", { ascending: false }).limit(200),
    sb.from("questions").select("style").eq("origin", "pyq").like("style", "apt:%").eq("status", "active").limit(5000),
  ]);
  const pyqCount = new Map<string, number>();
  for (const r of pyq ?? []) pyqCount.set(r.style, (pyqCount.get(r.style) ?? 0) + 1);
  const acc = (types: string[]) => {
    const rows = (past ?? []).filter((t) => ((t.result as { types?: string[] })?.types ?? []).some((k) => types.includes(k)));
    const max = rows.reduce((s, r) => s + Number(r.max_score), 0);
    return max ? Math.round((rows.reduce((s, r) => s + Number(r.score), 0) / max) * 100) : null;
  };
  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-xl font-bold text-brand-700">திறனறிவும் மனக்கணக்கும்</h1>
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Aptitude &amp; Mental Ability</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><p className="text-3xl font-bold">10</p><p className="text-sm text-stone-600">முக்கியத் தலைப்புகள்</p></div>
          <div><p className="text-3xl font-bold">25</p><p className="text-sm text-stone-600">தேர்வு வினாக்கள் (குரூப் 4)</p></div>
        </div>
        <h2 className="mt-4 font-semibold">கற்றல் பிரிவுகள்</h2>
        <ol className="mt-1 divide-y divide-stone-100">
          {APT_TOPICS.map((t, i) => {
            const a = acc(t.types), n = pyqCount.get(`apt:${t.key}`) ?? 0;
            return (
              <li key={t.key}>
                <Link href={`/aptitude/${t.key}`} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{t.en}</span>
                    <span className="block text-sm text-stone-500">{t.ta}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      {a != null && <span className={`chip ${a >= 70 ? "bg-brand-50 text-brand-700" : a >= 40 ? "bg-turmeric-50 text-turmeric-500" : "bg-kumkum-50 text-kumkum-500"}`}>துல்லியம் {a}%</span>}
                      {n > 0 && <span className="chip">TNPSC வினாக்கள் {n}</span>}
                    </span>
                  </span>
                  <span className="text-stone-400">›</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <Link href="/aptitude/shortcuts" className="card flex items-center gap-3 border-gold-500/40 bg-gold-400/10">
        <span className="text-2xl">⚡</span>
        <span><span className="block font-semibold">சுருக்கு வழி அட்டவணை (Cheat sheet)</span><span className="block text-sm text-stone-600">பின்னம் ↔ %, வர்க்கம், கனம், வகுபடும் விதிகள், கணக்குத் தந்திரங்கள், சூத்திரங்கள் — நினைவு அட்டைகளாகவும்</span></span>
      </Link>

      <AptitudeDrill keys={APT_TOPICS.flatMap((t) => t.types)} n={25} title="முழுப் பகுதி – 25 வினாக்கள் (தேர்வு போல)" seconds={25 * 36} />
    </div>
  );
}
