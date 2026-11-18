export const taDate = (d: string | Date, withWeekday = false) =>
  new Intl.DateTimeFormat("ta-IN", { day: "numeric", month: "long", year: "numeric", ...(withWeekday ? { weekday: "long" } : {}), timeZone: "Asia/Kolkata" }).format(
    typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00+05:30" : d) : d
  );
export const daysUntil = (d: string) => Math.ceil((new Date(d + "T00:00:00+05:30").getTime() - Date.now()) / 864e5);
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const STATUS: Record<string, string> = { todo: "தொடங்கவில்லை", studying: "படிக்கிறேன்", done: "முடிந்தது", revised: "திருப்புதல் செய்தேன்" };
export const OPT = ["அ", "ஆ", "இ", "ஈ"];
