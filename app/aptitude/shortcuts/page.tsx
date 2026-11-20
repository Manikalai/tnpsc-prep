import Link from "next/link";
import { APT_TOPICS } from "@/lib/aptitude-topics";
import AddCards from "@/components/AddCards";

export const metadata = { title: "சுருக்கு வழி அட்டவணை · Saranya Prep" };

const frac = (n: number, d: number) => {
  const v = (n / d) * 100;
  const whole = Math.floor(v), rem = Math.round((v - whole) * d) ;
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  if (Math.abs(v - Math.round(v * 100) / 100) < 1e-9) return `${v}%`;
  if (rem === 0) return `${whole}%`;
  const k = g(rem, d);
  return `${whole} ${rem / k}/${d / k}%`;
};
const FRACS: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [1, 6], [5, 6], [1, 7], [1, 8], [3, 8], [5, 8], [7, 8], [1, 9], [1, 10], [1, 11], [1, 12], [1, 15], [1, 16], [1, 20], [1, 25], [1, 40], [1, 50]];
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PRIMES = Array.from({ length: 99 }, (_, i) => i + 2).filter((n) => Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d));

const TRICKS: [string, string][] = [
  ["× 5", "× 10 ÷ 2 (48 × 5 = 480 ÷ 2 = 240)"],
  ["× 25", "× 100 ÷ 4 (36 × 25 = 3600 ÷ 4 = 900)"],
  ["× 11 (2 இலக்கம்)", "இலக்கங்களுக்கு நடுவில் அவற்றின் கூட்டுத்தொகை: 43 × 11 = 4(4+3)3 = 473; 10-ஐத் தாண்டினால் 1-ஐ முன்னால் சேர்க்க (78 × 11 = 858)"],
  ["× 9, × 99", "× 10 − எண், × 100 − எண் (47 × 99 = 4700 − 47 = 4653)"],
  ["5-இல் முடியும் வர்க்கம்", "முன் இலக்கம் × (அது + 1), பின் 25: 75² = 7 × 8 | 25 = 5625"],
  ["50-க்கு அருகில் வர்க்கம்", "48² = (25 − 2) | 2² = 23 | 04 = 2304; 53² = (25 + 3) | 09 = 2809"],
  ["100-க்கு அருகில் பெருக்கல்", "97 × 96: குறைவுகள் 3, 4 → 97 − 4 = 93 | 3 × 4 = 12 → 9312"],
  ["வர்க்க வேறுபாடு", "49 × 51 = 50² − 1² = 2499; 98 × 102 = 10000 − 4 = 9996"],
  ["x% of y", "= y% of x (8% of 50 = 50% of 8 = 4)"],
  ["இலக்கக் கூட்டுச் சோதனை", "இரு பக்க இலக்கக் கூட்டுத்தொகைகளை 9 வரை சுருக்கி ஒப்பிடவும் — பொருந்தாத விடையை உடனே நீக்கலாம்"],
  ["கடைசி இலக்கம்", "பெருக்கலின் கடைசி இலக்கம் = கடைசி இலக்கங்களின் பெருக்கலின் கடைசி இலக்கம் — விடைகளை வேகமாக நீக்க"],
  ["கனமூலம் (சரியான கனம்)", "கடைசி இலக்கம் → மூலத்தின் கடைசி இலக்கம்: 1→1, 8→2, 7→3, 4→4, 5→5, 6→6, 3→7, 2→8, 9→9, 0→0"],
];
// word-problem shortcuts by topic: [topic, trick, worked example] — every example checked by hand
const TOPIC_HACKS: [string, string, string][] = [
  ["சதவீதம் · அடுத்தடுத்த மாற்றம்", "a% பின் b% மாற்றம் = a + b + ab/100 (குறைவுக்கு − குறி)", "+20% பின் −10% → 20 − 10 − 2 = +8%"],
  ["சதவீதம் · விலை ஏற்றம், செலவு அதே", "நுகர்வைக் குறைக்க வேண்டியது = r/(100 + r) × 100 %", "விலை 25% ஏற்றம் → 25/125 × 100 = 20% குறைக்க"],
  ["இலாபம் – நட்டம் · அதே விற்பனை விலை", "ஒன்றில் x% இலாபம், மற்றொன்றில் x% நட்டம் → எப்போதும் x²/100 % நட்டம்", "10% → 100/100 = 1% நட்டம்"],
  ["இலாபம் – நட்டம் · போலி எடை", "இலாப % = குறைவு ÷ (உண்மை − குறைவு) × 100", "1 கிலோவுக்கு 900 கி → 100/900 × 100 = 11 1/9 %"],
  ["வட்டி · தனி – கூட்டு வேறுபாடு", "2 ஆண்டு: P(r/100)² · 3 ஆண்டு: P(r/100)²(3 + r/100)", "P = 10000, r = 10% → 2 ஆண்டு ₹100, 3 ஆண்டு ₹310"],
  ["வட்டி · இரு மடங்காக", "தனி வட்டியில் n ஆண்டில் இரு மடங்கு → r = 100/n; k மடங்கு → r = 100(k − 1)/n", "8 ஆண்டில் இரு மடங்கு → 12.5%"],
  ["வேலை – நேரம்", "A: a நாள், B: b நாள் → சேர்ந்து ab/(a + b) நாள் (அல்லது மொத்த வேலை = LCM)", "12, 6 நாள் → 72/18 = 4 நாள்"],
  ["வேகம் · சராசரி வேகம்", "ஒரே தூரம் x, y வேகத்தில் → 2xy/(x + y)", "40, 60 கி.மீ/ம → 4800/100 = 48"],
  ["வேகம் · அலகு மாற்றம்", "கி.மீ/ம → மீ/வி: × 5/18 · மீ/வி → கி.மீ/ம: × 18/5", "72 கி.மீ/ம = 20 மீ/வி"],
  ["தொடர்வண்டி", "கம்பம் கடக்க: நீளம் ÷ வேகம் · எதிர் திசை: (L₁+L₂)/(v₁+v₂) · ஒரே திசை: (L₁+L₂)/(v₁−v₂)", "150 மீ, 15 மீ/வி → 10 வினாடி"],
  ["சராசரி · ஆள் மாற்றம்", "n பேரில் ஒருவருக்குப் பதில் புதியவர், சராசரி d கூடினால் → புதியவர் = போனவர் + n × d", "8 பேர், 60 கிலோ போனவர், சராசரி +2.5 → 60 + 20 = 80 கிலோ"],
  ["விகிதம் · இணைத்தல்", "A:B, B:C → B-ஐ இரண்டிலும் சமமாக்கு", "A:B = 2:3, B:C = 4:5 → 8:12:15"],
  ["கூட்டாண்மை", "இலாபப் பங்கு = முதலீடு × காலம் விகிதத்தில்", "₹4000 × 12, ₹6000 × 6 → 48:36 = 4:3"],
  ["கலவை (Alligation)", "மலிவு : விலை உயர்ந்தது = (உயர் − சராசரி) : (சராசரி − மலிவு)", "₹30, ₹40 அரிசி, சராசரி ₹34 → 6:4 = 3:2"],
  ["கடிகாரம்", "முள் கோணம் = |30H − 5.5M| · இரு முள்ளும் ஒன்றுசேர்வது ஒவ்வொரு 65 5/11 நிமிடத்திலும், நாளுக்கு 22 முறை", "3:40 → |90 − 220| = 130°"],
  ["நாள்காட்டி", "ஒற்றை நாள்: சாதாரண ஆண்டு 1, லீப் 2 · 100 ஆண்டு = 5, 200 = 3, 300 = 1, 400 = 0", "லீப் ஆண்டு: 4-ஆல் வகுபடும்; நூற்றாண்டு எனில் 400-ஆல்"],
  ["எண்கள் · LCM, HCF", "இரு எண்களின் பெருக்கல் = LCM × HCF", "12, 18 → 216 = 36 × 6"],
  ["எண்கள் · கடைசி இலக்கச் சுழற்சி", "2: 2,4,8,6 · 3: 3,9,7,1 · 7: 7,9,3,1 · 8: 8,4,2,6 (சுழற்சி 4) · 4: 4,6 · 9: 9,1", "7²⁵ → 25 ÷ 4 மீதி 1 → கடைசி இலக்கம் 7"],
  ["எண்ணுதல்", "கைகுலுக்கல் n(n − 1)/2 · பலகோண மூலைவிட்டம் n(n − 3)/2", "10 பேர் → 45 · அறுகோணம் → 9"],
];
const DIV: [string, string][] = [
  ["2", "கடைசி இலக்கம் இரட்டை எண்"], ["3", "இலக்கக் கூட்டுத்தொகை 3-ஆல் வகுபடும்"], ["4", "கடைசி இரண்டு இலக்கம் 4-ஆல் வகுபடும்"],
  ["5", "கடைசி இலக்கம் 0 அல்லது 5"], ["6", "2-ஆலும் 3-ஆலும் வகுபடும்"], ["8", "கடைசி மூன்று இலக்கம் 8-ஆல் வகுபடும்"],
  ["9", "இலக்கக் கூட்டுத்தொகை 9-ஆல் வகுபடும்"], ["10", "கடைசி இலக்கம் 0"], ["11", "ஒற்றை இட இலக்கக் கூட்டு − இரட்டை இட இலக்கக் கூட்டு = 0 அல்லது 11-இன் மடங்கு"],
];

export default function Shortcuts() {
  const squares = Array.from({ length: 30 }, (_, i) => i + 1);
  const cubes = Array.from({ length: 15 }, (_, i) => i + 1);
  return (
    <div className="space-y-4">
      <p className="muted">மனப்பாடம் செய்ய வேண்டியவை. ஒவ்வொரு பகுதியையும் நினைவு அட்டைகளாகச் சேர்த்தால் 1, 3, 7, 15 நாள் இடைவெளியில் மீண்டும் வரும்.</p>

      <section className="card">
        <h2 className="h2 mb-2">பின்னம் ↔ விழுக்காடு</h2>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[15px] sm:grid-cols-4">
          {FRACS.map(([n, d]) => (
            <div key={`${n}/${d}`} className="rounded-lg bg-stone-50 py-1.5"><b>{n}/{d}</b> = {frac(n, d)}</div>
          ))}
        </div>
        <AddCards cards={FRACS.map(([n, d]) => ({ front: `${n}/${d} = எத்தனை %?`, back: frac(n, d) }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">வர்க்கங்கள் 1–30</h2>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[15px] sm:grid-cols-6">
          {squares.map((n) => <div key={n} className="rounded-lg bg-stone-50 py-1">{n}² = <b>{n * n}</b></div>)}
        </div>
        <AddCards cards={squares.filter((n) => n > 10).map((n) => ({ front: `${n}² = ?`, back: String(n * n) }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">கனங்கள் 1–15</h2>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[15px] sm:grid-cols-5">
          {cubes.map((n) => <div key={n} className="rounded-lg bg-stone-50 py-1">{n}³ = <b>{n ** 3}</b></div>)}
        </div>
        <AddCards cards={cubes.filter((n) => n > 3).map((n) => ({ front: `${n}³ = ?`, back: String(n ** 3) }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">கணக்குத் தந்திரங்கள்</h2>
        <div className="divide-y divide-stone-100">
          {TRICKS.map(([k, v]) => <div key={k} className="py-2"><p className="font-semibold text-maroon-700">{k}</p><p className="text-[15px]">{v}</p></div>)}
        </div>
        <AddCards cards={TRICKS.map(([k, v]) => ({ front: `தந்திரம்: ${k}`, back: v }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-1">தலைப்பு வாரியான குறுக்கு வழிகள்</h2>
        <p className="muted mb-2">கணக்கை முழுதாகப் போடாமல் நேரடியாக விடை — தேர்வில் நேரம் மிச்சம்</p>
        <div className="space-y-2.5">
          {TOPIC_HACKS.map(([t, h, ex]) => (
            <div key={t} className="rounded-xl bg-stone-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-saffron-500">{t}</p>
              <p className="mt-0.5 text-[15px] font-semibold leading-relaxed">{h}</p>
              <p className="mt-1 rounded-lg bg-white px-2.5 py-1.5 text-[14px] text-brand-700 ring-1 ring-stone-200">எ.கா.: {ex}</p>
            </div>
          ))}
        </div>
        <AddCards cards={TOPIC_HACKS.map(([t, h, ex]) => ({ front: `குறுக்கு வழி: ${t}`, back: `${h}\nஎ.கா.: ${ex}` }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">வகுபடும் விதிகள்</h2>
        <div className="divide-y divide-stone-100">
          {DIV.map(([k, v]) => <div key={k} className="flex gap-3 py-1.5"><b className="w-8 shrink-0 text-brand-700">{k}</b><span className="text-[15px]">{v}</span></div>)}
        </div>
        <AddCards cards={DIV.map(([k, v]) => ({ front: `${k}-ஆல் வகுபடும் விதி?`, back: v }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">எழுத்து நிலைகள் (A = 1 … Z = 26)</h2>
        <div className="grid grid-cols-7 gap-1 text-center text-sm sm:grid-cols-9">
          {A.map((c, i) => <div key={c} className={`rounded-md py-1 ${[4, 9, 14, 19, 24].includes(i) ? "bg-gold-400/30 font-bold" : "bg-stone-50"}`}>{c}<br /><span className="text-xs">{i + 1}</span></div>)}
        </div>
        <p className="mt-2 text-[15px]"><b>EJOTY</b> = 5, 10, 15, 20, 25 · எதிர் எழுத்து: நிலைகளின் கூட்டு 27 (A↔Z, B↔Y, M↔N) · பின்னிருந்து நிலை = 27 − முன் நிலை</p>
        <AddCards cards={A.map((c, i) => ({ front: `${c} = ?`, back: `${i + 1} (எதிர்: ${A[25 - i]})` }))} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">பகா எண்கள் (100 வரை) · பித்தாகரஸ் மூவெண்கள்</h2>
        <p className="text-[15px] leading-relaxed">{PRIMES.join(", ")} <span className="text-stone-500">({PRIMES.length} எண்கள்)</span></p>
        <p className="mt-2 text-[15px]">(3, 4, 5) · (5, 12, 13) · (6, 8, 10) · (7, 24, 25) · (8, 15, 17) · (9, 12, 15) · (20, 21, 29)</p>
      </section>

      <section className="card">
        <h2 className="h2 mb-2">எல்லாச் சூத்திரங்களும் (தலைப்பு வாரியாக)</h2>
        {APT_TOPICS.map((t) => (
          <div key={t.key} className="mt-3">
            <Link href={`/aptitude/${t.key}?tab=understand`} className="font-semibold text-brand-700 underline">{t.ta}</Link>
            <ul className="mt-1 space-y-0.5 text-[15px]">{t.formulas.map((f) => <li key={f.name}><span className="text-stone-500">{f.name}:</span> <b>{f.f}</b></li>)}</ul>
          </div>
        ))}
        <AddCards cards={APT_TOPICS.flatMap((t) => t.formulas.map((f) => ({ front: `${t.ta} — ${f.name}?`, back: f.f })))} label="Add all formulas as flashcards" />
      </section>
    </div>
  );
}
