export const MediqueLogo = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 400 88"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    className={className}
    aria-label="Aura Vita Clinic"
  >
    {/* ── TOOTH OUTLINE ── */}
    <path
      d="
        M 25,70 Q 22,58 22,46
        C 19,38 19,28 23,20
        C 26,13 30,10 34,12
        C 36,8 37,7 38,7
        C 39,7 40,8 42,12
        C 46,10 50,13 53,20
        C 57,28 57,38 54,46
        Q 54,58 51,70
        Q 48,77 44,72
        Q 41,67 38,67
        Q 35,67 32,72
        Q 28,77 25,70 Z
      "
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />

    {/* ── SPARKLE (4-point star, top-right of tooth) ── */}
    <line x1="64" y1="2"  x2="64" y2="14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="58" y1="8"  x2="70" y2="8"  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="60" y1="4"  x2="68" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />
    <line x1="68" y1="4"  x2="60" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />

    {/* ── DECORATIVE SWOOSH (two orbit arcs around right side) ── */}
    <path
      d="M 70,76 Q 78,55 72,32 Q 66,12 52,5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeOpacity="0.45"
    />
    <path
      d="M 75,80 Q 84,57 77,29 Q 70,8 54,2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeOpacity="0.2"
    />

    {/* ── DIVIDER ── */}
    <line x1="85" y1="7" x2="85" y2="81" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.18" />

    {/* ── AURA VITA ── */}
    <text
      x="98"
      y="62"
      fontFamily="'Josefin Sans', 'Inter', sans-serif"
      fontWeight="300"
      fontSize="44"
      letterSpacing="2"
      fill="currentColor"
    >AURA VITA</text>

    {/* Decorative horizontal rules cutting mid-cap */}
    <rect x="98" y="37"   width="288" height="1"   fillOpacity="0.4" />
    <rect x="98" y="40.5" width="288" height="0.5" fillOpacity="0.18" />

    {/* ── CLINIC ── */}
    <text
      x="222"
      y="77"
      textAnchor="middle"
      fontFamily="'Josefin Sans', 'Inter', sans-serif"
      fontWeight="300"
      fontSize="11"
      letterSpacing="7"
      fill="currentColor"
    >CLINIC</text>
  </svg>
);
