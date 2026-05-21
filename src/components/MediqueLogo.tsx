/**
 * Inline SVG logo — crisp at any size, no image file needed.
 * Uses currentColor so it adapts automatically (white on hero, dark when scrolled).
 */
export const MediqueLogo = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 400 88"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    className={className}
    aria-label="Medique Clinic"
  >
    {/* ── SOLID SILHOUETTE — hair bun, head, coat, stethoscope ── */}

    {/* Hair bun — rounded blob sitting on top-right of head */}
    <ellipse cx="46" cy="9" rx="10" ry="7.5" />
    <ellipse cx="38" cy="11" rx="7" ry="5.5" />

    {/* Head */}
    <ellipse cx="38" cy="27" rx="13" ry="14.5" />

    {/* Neck */}
    <path d="M32 40 L44 40 L44 46 L32 46Z" />

    {/* Coat body — solid silhouette, wide shoulders, full to bottom */}
    <path d="
      M8 88
      C7 66 16 54 28 48
      L31 43
      C33 47 36 49 38 49
      C40 49 43 47 45 43
      L48 48
      C60 54 69 66 68 88
      Z
    " />

    {/* Stethoscope — clean arc loop + chest piece, slightly lighter */}
    <path
      d="M21 67 C13 57 15 46 21 42 C26 38 34 41 36 47"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="18" cy="73" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="18" cy="73" r="2.4" />

    {/* ── DIVIDER ── */}
    <line x1="82" y1="7" x2="82" y2="81" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.18" />

    {/* ── MEDIQUE ── */}
    <text
      x="96"
      y="62"
      fontFamily="'Josefin Sans', 'Inter', sans-serif"
      fontWeight="300"
      fontSize="52"
      letterSpacing="3"
      fill="currentColor"
    >MEDIQUE</text>

    {/* Decorative horizontal rules cutting mid-cap */}
    <rect x="96" y="37" width="300" height="1" fillOpacity="0.4" />
    <rect x="96" y="40.5" width="300" height="0.5" fillOpacity="0.18" />

    {/* ── CLINIC ── */}
    <text
      x="246"
      y="78"
      textAnchor="middle"
      fontFamily="'Josefin Sans', 'Inter', sans-serif"
      fontWeight="300"
      fontSize="11"
      letterSpacing="7"
      fill="currentColor"
    >CLINIC</text>
  </svg>
);
