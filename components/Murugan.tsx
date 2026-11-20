// Murugan theme art (drawn here, original): the Vel and a peacock feather.
export function Vel({ className = "", gold = "#f2c14e", dark = "#b8860b" }: { className?: string; gold?: string; dark?: string }) {
  // broad leaf blade with vibhuti + kumkum, lotus collar, beads, ruby knob, banded shaft
  const id = `vel${gold.slice(1)}${dark.slice(1)}`;
  return (
    <svg viewBox="0 0 64 160" className={className} aria-hidden>
      <defs>
      <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={dark}/><stop offset=".22" stopColor={gold}/><stop offset=".5" stopColor="#fff3c4"/><stop offset=".78" stopColor={gold}/><stop offset="1" stopColor={dark}/></linearGradient>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={dark}/><stop offset=".45" stopColor={gold}/><stop offset="1" stopColor={dark}/></linearGradient>
      </defs>
      <path d="M32 1C43 15 57 31 56 48C55 61 44 68 32 73C20 68 9 61 8 48C7 31 21 15 32 1Z" fill={`url(#${id}b)`} stroke={dark} strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M32 10C40 22 49 34 48.5 47C48 57 40.5 62 32 66C23.5 62 16 57 15.5 47C15 34 24 22 32 10Z" fill="none" stroke={dark} strokeWidth="1.3" opacity=".7"/>
      <path d="M32 12V30M32 56V64" stroke={dark} strokeWidth="1.2" opacity=".55"/>
      <g stroke="#fffaf0" strokeWidth="2.6" strokeLinecap="round"><path d="M22 37H42"/><path d="M21 42.5H43"/><path d="M22 48H42"/></g>
      <circle cx="32" cy="42.5" r="3.6" fill="#d32f2f" stroke="#7f1010" strokeWidth=".8"/>
      <path d="M14 72C20 70 26 71 32 76C38 71 44 70 50 72C47 79 40 81 32 80C24 81 17 79 14 72Z" fill={`url(#${id}s)`} stroke={dark} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M24 74.5Q28 79 32 76M40 74.5Q36 79 32 76" fill="none" stroke={dark} strokeWidth="1" opacity=".7"/>
      <g fill={gold} stroke={dark} strokeWidth="1.1"><circle cx="25" cy="84.5" r="2.6"/><circle cx="32" cy="85" r="2.8"/><circle cx="39" cy="84.5" r="2.6"/></g>
      <circle cx="32" cy="94" r="6.5" fill={`url(#${id}s)`} stroke={dark} strokeWidth="1.6"/>
      <circle cx="32" cy="94" r="2.6" fill="#d32f2f" stroke="#7f1010" strokeWidth=".7"/>
      <path d="M24.5 101.5H39.5L36.5 106.5H27.5Z" fill={`url(#${id}s)`} stroke={dark} strokeWidth="1.4" strokeLinejoin="round"/>
      <rect x="27.5" y="106" width="9" height="44" rx="3" fill={`url(#${id}s)`} stroke={dark} strokeWidth="1.4"/>
      <g fill={gold} stroke={dark} strokeWidth="1.1"><rect x="26" y="118" width="12" height="3.6" rx="1.5"/><rect x="26" y="134" width="12" height="3.6" rx="1.5"/></g>
      <path d="M25.5 149.5H38.5L32 159Z" fill={`url(#${id}s)`} stroke={dark} strokeWidth="1.4" strokeLinejoin="round"/>
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

/** Thiruneeru (three lines of holy ash) with a kumkum dot — small ornament. */
export function Tilak({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 22" className={className} aria-hidden>
      {[3, 9, 15].map((y) => <rect key={y} x="2" y={y} width="56" height="3.2" rx="1.6" fill="#fffaf0" opacity=".95" />)}
      <circle cx="30" cy="10.6" r="4.2" fill="#c62828" stroke="#fffaf0" strokeWidth="1" />
    </svg>
  );
}

/** Six-sided star of Shanmukha (ஆறுமுகம்) — temple-gold ornament. */
export function Shatkonam({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points="50,6 88,72 12,72" fill="none" stroke="currentColor" strokeWidth="4" />
      <polygon points="50,94 12,28 88,28" fill="none" stroke="currentColor" strokeWidth="4" />
      <text x="50" y="60" textAnchor="middle" fontSize="26" fontWeight="700" fill="currentColor">ௐ</text>
    </svg>
  );
}
