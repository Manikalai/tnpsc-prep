// Labels shared by server and browser code (no server-only imports here).
export const SECTIONS: Record<string, Record<string, string>> = {
  social: { history: "வரலாறு", geography: "புவியியல்", civics: "குடிமையியல்", economics: "பொருளியல்", ethics: "அறவியல் – பண்பாடு" },
  science: { physics: "இயற்பியல்", chemistry: "வேதியியல்", biology: "உயிரியல்", other: "பிற அறிவியல்" },
  tamil: { grammar: "இலக்கணம்", literature: "இலக்கியம்", prose: "உரைநடை / துணைப்பாடம்" },
};
export const DIFFICULTY: Record<string, string> = { easy: "எளிது", medium: "நடுத்தரம்", hard: "கடினம்", mixed: "கலவை" };

