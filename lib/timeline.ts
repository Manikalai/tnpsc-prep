// Years & events from every lesson's "dates" notes, put on one timeline with anchors and eras for memorising.
export type TEvent = { year: number; approx: boolean; label: string; event: string; chapterId: number; lesson: string; book: string; std: number; subject: string; section: string | null };

/** Year from a Tamil date string: "1905", "கி.பி. 1336", "15 ஆகஸ்ட் 1947", "கி.மு. 326", "கி.மு. 6ஆம் நூற்றாண்டு". */
export function parseYear(s: string): { year: number; approx: boolean } | null {
  const t = s.replace(/\s+/g, " ");
  const bce = /கி\.?\s?மு|BCE|B\.C/i.test(t);
  const cent = t.match(/(\d{1,2})\s*(?:ஆம்|-ஆம்|ம்)?\s*நூற்றாண்டு|(\d{1,2})(?:st|nd|rd|th)\s*century/i);
  const yr = t.match(/(\d{3,4})/);
  if (yr) {
    const y = Number(yr[1]);
    if (y < 1 || y > 2100) return null;
    return { year: bce ? -y : y, approx: /சுமார்|ஏறத்தாழ|c\.|circa/i.test(t) };
  }
  if (cent) {
    const c = Number(cent[1] ?? cent[2]);
    if (!c || c > 21) return null;
    const mid = (c - 1) * 100 + 50;
    return { year: bce ? -mid : mid, approx: true };
  }
  return null;
}

export const ANCHORS: [number, string][] = [
  [1498, "வாஸ்கோடகாமா கள்ளிக்கோட்டை வருகை"],
  [1526, "முதல் பானிபட் போர்"],
  [1757, "பிளாசிப் போர்"],
  [1857, "முதல் இந்திய விடுதலைப் போர்"],
  [1885, "இந்திய தேசிய காங்கிரஸ் தோற்றம்"],
  [1905, "வங்கப் பிரிவினை"],
  [1919, "ஜாலியன்வாலா பாக் படுகொலை"],
  [1920, "ஒத்துழையாமை இயக்கம்"],
  [1930, "உப்புச் சத்தியாகிரகம்"],
  [1942, "வெள்ளையனே வெளியேறு இயக்கம்"],
  [1947, "இந்திய விடுதலை"],
  [1950, "இந்தியா குடியரசு"],
];

export const ERAS: { from: number; to: number; name: string }[] = [
  { from: -100000, to: -601, name: "பண்டைய காலம் (கி.மு. 600-க்கு முன்)" },
  { from: -600, to: 599, name: "கி.மு. 600 – கி.பி. 600 (மௌரியர், சங்க காலம், குப்தர்)" },
  { from: 600, to: 1525, name: "இடைக்காலம் (பல்லவர், சோழர், பாண்டியர், டெல்லி சுல்தான்கள், விஜயநகரம்)" },
  { from: 1526, to: 1756, name: "முகலாயர் காலம்" },
  { from: 1757, to: 1856, name: "ஆங்கிலேயர் ஆதிக்கம் (பிளாசி முதல்)" },
  { from: 1857, to: 1946, name: "விடுதலைப் போராட்டம்" },
  { from: 1947, to: 2100, name: "விடுதலைக்குப் பின்" },
];

export const fmtYear = (y: number) => (y < 0 ? `கி.மு. ${-y}` : String(y));

/** "1947-க்கு 42 ஆண்டுகள் முன்" — link each year to the nearest anchor year. */
export function nearestAnchor(y: number) {
  if (y < 1400) return null;
  let best = ANCHORS[0];
  for (const a of ANCHORS) if (Math.abs(a[0] - y) < Math.abs(best[0] - y)) best = a;
  const d = y - best[0];
  if (d === 0) return { anchor: best, text: `${best[0]} — ${best[1]}` };
  return { anchor: best, text: `${best[0]}-க்கு ${Math.abs(d)} ஆண்டுகள் ${d < 0 ? "முன்" : "பின்"} (${best[1]})` };
}
