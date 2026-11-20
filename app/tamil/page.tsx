import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StartButton from "@/components/StartButton";
import { GT_TOPICS } from "@/lib/tamil";
import Emoji from "@/components/Emoji";

export const dynamic = "force-dynamic";

// பொதுத் தமிழ்: half of the Group 4 paper (100 of 200) and the qualifying part.
export default async function TamilPage() {
  await requireUser();
  const admin = supabaseAdmin();
  const head = () => admin.from("questions").select("id", { count: "exact", head: true }).eq("status", "active");
  const [pyq, all, ...topicCounts] = await Promise.all([
    head().eq("origin", "pyq").like("unit_id", "G4-TAMIL-%"),
    head().like("unit_id", "G4-TAMIL-%"),
    ...GT_TOPICS.map((t) => head().eq("style", `gt:${t.key}`)),
  ]);
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-maroon-700 via-maroon-600 to-saffron-500 p-5 text-white shadow-lg">
        <p className="text-sm font-semibold text-gold-400">பகுதி அ · தமிழ்த் தகுதித் தேர்வு</p>
        <h1 className="mt-1 text-2xl font-bold">பொதுத் தமிழ்</h1>
        <p className="mt-1 text-sm text-white/85">200-இல் 100 வினாக்கள் (150 மதிப்பெண்) — பாதி மதிப்பெண் இங்கே. தகுதிக்குக் குறைந்தது 60/150 (40 சரியான விடைகள்).</p>
        <div className="mt-3 flex gap-2">
          <StartButton url="/api/tamil" body={{ topic: "all", count: 25 }} label="Mixed 25" busyLabel="…" className="btn !bg-white !text-maroon-700" />
          <StartButton url="/api/tamil" body={{ topic: "pyq", count: 25 }} label={`Past papers (${pyq.count ?? 0})`} busyLabel="…" className="btn-ghost !border-white/50 !bg-white/10 !text-white" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/tamil/kural" className="card !bg-gradient-to-br from-amber-50 to-white">
          <Emoji name="scroll" size={40} /><p className="mt-1 font-bold">திருக்குறள்</p><p className="muted">1330 குறள்கள் · வினாடி வினா</p>
        </Link>
        <Link href="/tamil/nool" className="card !bg-gradient-to-br from-amber-50 to-white">
          <Emoji name="writing" size={40} /><p className="mt-1 font-bold">நூல் – ஆசிரியர்</p><p className="muted">பாடநூல் நூல்வெளி</p>
        </Link>
      </div>

      <section className="card">
        <h2 className="h2">Practice by topic</h2>
        <p className="muted">உங்கள் தமிழ்ப் பாடநூல்களிலிருந்து (6–12) · ஒவ்வொரு விடையும் பாடத்துடன் சரிபார்க்கப்பட்டது</p>
        <div className="mt-2 divide-y divide-stone-100">
          {GT_TOPICS.map((t, i) => {
            const n = topicCounts[i].count ?? 0;
            return (
              <div key={t.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="font-semibold">{t.ta}</p><p className="text-xs text-stone-500">{n} வினாக்கள்</p></div>
                {n > 0 ? <StartButton url="/api/tamil" body={{ topic: t.key }} label="Start" busyLabel="…" className="btn btn-sm shrink-0" /> : <span className="chip">விரைவில்</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card flex items-center justify-between gap-3">
        <div><p className="font-semibold">தமிழ்ப் பாடங்கள்</p><p className="muted">பாடநூல், எளிய குறிப்புகள், புத்தக வினாக்கள்</p></div>
        <Link href="/books" className="btn-ghost btn-sm">Open</Link>
      </section>
      <p className="text-center text-xs text-stone-400">மொத்தம் {all.count ?? 0} தமிழ் வினாக்கள்</p>
    </div>
  );
}
