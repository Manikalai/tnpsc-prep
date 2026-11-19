// Murugan theme: slogans, the six abodes (ஆறுபடை வீடுகள்), and helpers.

export const SLOGANS = [
  "வெற்றி வேல்! வீர வேல்!",
  "முருகா! முருகா!",
  "சரவணபவ!",
  "வேல் உண்டு வினை இல்லை",
  "கந்தன் அருள் இருந்தால் வெற்றி நிச்சயம்",
  "ஓம் சரவணபவ",
  "ஆறுபடை வீடு கொண்டவனே போற்றி",
  "யாமிருக்க பயமேன்",
  "முருகனுக்கு அரோகரா!",
  "காக்க காக்க கனகவேல் காக்க",
  "வேலும் மயிலும் துணை",
  "வெற்றிவேல் முருகனுக்கு அரோகரா!",
  "கந்தனுக்கு அரோகரா!",
  "வேல் வேல் வெற்றி வேல்!",
  "முருகா சரணம்",
  "சண்முகா சரணம்",
  "கந்தா கடம்பா கதிர்வேலா!",
  "குன்றுதோறாடும் குமரா போற்றி",
  "தமிழ்க் கடவுள் முருகா போற்றி",
  "சஷ்டியை நோக்க சரவண பவனார்",
  "நோக்க நோக்க நொடியில் நோக்க",
  "கந்தன் இருக்க கவலை ஏன்?",
  "வேலுண்டு பயமில்லை",
  "ஆறுமுகன் அருள் என்றும் துணை",
];

/** Murugan's names — one each day on the home page. */
export const NAMES = ["முருகன்", "கந்தன்", "குமரன்", "கார்த்திகேயன்", "சுப்பிரமணியன்", "ஆறுமுகன்", "சண்முகன்", "சரவணன்", "வேலவன்", "தண்டாயுதபாணி", "செந்திலாண்டவன்", "குகன்", "கடம்பன்", "சேயோன்", "சுவாமிநாதன்"];
export function nameOfDay() {
  const day = Math.floor((Date.now() + 5.5 * 3600e3) / 864e5);
  return NAMES[day % NAMES.length];
}

/** Same slogan all day (changes at midnight IST). */
export function sloganOfDay(offset = 0) {
  const day = Math.floor((Date.now() + 5.5 * 3600e3) / 864e5);
  return SLOGANS[(day + offset) % SLOGANS.length];
}
export const randomSlogan = () => SLOGANS[Math.floor(Math.random() * SLOGANS.length)];

/** The six abodes of Murugan, used as the six stages of her syllabus journey. */
export const ABODES = [
  { name: "திருப்பரங்குன்றம்", place: "மதுரை", note: "தெய்வானை திருமணம்" },
  { name: "திருச்செந்தூர்", place: "தூத்துக்குடி", note: "சூரசம்ஹாரம், கடற்கரைக் கோயில்" },
  { name: "பழனி", place: "திண்டுக்கல்", note: "தண்டாயுதபாணி" },
  { name: "சுவாமிமலை", place: "தஞ்சாவூர்", note: "தந்தைக்கு ஓம் பொருள் உரைத்த இடம்" },
  { name: "திருத்தணி", place: "திருவள்ளூர்", note: "வள்ளி திருமணம்" },
  { name: "பழமுதிர்ச்சோலை", place: "மதுரை", note: "ஔவையாருக்கு அருளிய இடம்" },
] as const;

/** Exam-result blessing by score percentage. */
export function blessing(pct: number) {
  if (pct >= 80) return "வெற்றி வேல்! வீர வேல்! — அருமை சரண்யா!";
  if (pct >= 60) return "கந்தன் அருள் இருந்தால் வெற்றி நிச்சயம் — இன்னும் கொஞ்சம்!";
  if (pct >= 40) return "வேல் உண்டு வினை இல்லை — தவறியவற்றைத் திருப்புவோம்";
  return "யாமிருக்க பயமேன் — மீண்டும் முயல்வோம், சரண்யா";
}
