// Murugan theme art (drawn here, original): the Vel and a peacock feather.
export function Vel({ className = "", gold = "#f2c14e", dark = "#b8860b" }: { className?: string; gold?: string; dark?: string }) {
  return (
    <svg viewBox="0 0 64 160" className={className} aria-hidden>
      {/* blade */}
      <path d="M32 4C46 24 50 46 32 66C14 46 18 24 32 4Z" fill={gold} stroke={dark} strokeWidth="2" />
      <path d="M32 14C39 28 40 44 32 56C24 44 25 28 32 14Z" fill="none" stroke={dark} strokeWidth="1.6" opacity=".8" />
      <circle cx="32" cy="38" r="3.2" fill="#c62828" />
      {/* collar */}
      <path d="M20 70h24l-4 7H24z" fill={gold} stroke={dark} strokeWidth="1.6" />
      <circle cx="32" cy="82" r="5" fill={gold} stroke={dark} strokeWidth="1.6" />
      <path d="M24 90h16l-3 5H27z" fill={gold} stroke={dark} strokeWidth="1.4" />
      {/* shaft */}
      <rect x="29" y="95" width="6" height="56" rx="3" fill={gold} stroke={dark} strokeWidth="1.4" />
      <path d="M26 151h12l-6 7z" fill={gold} stroke={dark} strokeWidth="1.4" />
    </svg>
  );
}

export function PeacockFeather({ className = "" }: { className?: string }) {
  const barbs = Array.from({ length: 22 }, (_, i) => {
    const y = 18 + i * 7.5;
    const w = 26 - Math.abs(i - 6) * 0.9;
    return <path key={i} d={`M50 ${y + 12}Q${50 - w} ${y + 4} ${50 - w - 6} ${y - 6}M50 ${y + 12}Q${50 + w} ${y + 4} ${50 + w + 6} ${y - 6}`} stroke="#3f9c6d" strokeWidth="1.1" fill="none" opacity=".75" />;
  });
  return (
    <svg viewBox="0 0 100 200" className={className} aria-hidden>
      {barbs}
      <path d="M50 30V198" stroke="#c9a227" strokeWidth="1.6" />
      <ellipse cx="50" cy="44" rx="22" ry="27" fill="#2e8b57" />
      <ellipse cx="50" cy="46" rx="16" ry="20" fill="#d4a017" />
      <ellipse cx="50" cy="48" rx="12" ry="15" fill="#0f7f8c" />
      <ellipse cx="50" cy="51" rx="7" ry="9" fill="#1a3a8f" />
      <ellipse cx="50" cy="53" rx="3.5" ry="4.5" fill="#0b1a4a" />
    </svg>
  );
}
