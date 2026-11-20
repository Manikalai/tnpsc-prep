// 3D emoji (Microsoft Fluent Emoji, MIT licence), saved in /public/emoji so they work offline.
export type EmojiName = "abacus" | "bell" | "book" | "bookmark" | "books" | "brain" | "bulb" | "calendar" | "calendar2" | "cards" | "chart" | "clipboard" | "diya" | "fire" | "gear" | "globe" | "graduation" | "hourglass" | "lotus" | "magnifier" | "memo" | "muscle" | "news" | "notebook" | "offline" | "peacock" | "pencil" | "puzzle" | "question" | "repeat" | "scroll" | "sparkles" | "speech" | "star" | "stopwatch" | "target" | "trophy" | "writing";

export default function Emoji({ name, size = 28, className = "" }: { name: EmojiName; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/emoji/${name}.webp`} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} className={`inline-block shrink-0 select-none drop-shadow-[0_2px_3px_rgba(60,40,10,0.18)] ${className}`} style={{ width: size, height: size }} />;
}
