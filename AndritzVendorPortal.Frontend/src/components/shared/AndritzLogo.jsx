/**
 * AndritzLogo — renders the official Andritz wordmark as an inline SVG.
 * The colour defaults to white (for use on the dark sidebar / login panel).
 * Pass color="#1a6fae" for the blue version on a light background.
 */
export default function AndritzLogo({ color = 'white', className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 420 80"
      className={className}
      aria-label="Andritz"
      role="img"
      style={{ fill: color, display: 'block' }}
    >
      {/* ── A ── */}
      <polygon points="0,76 14,76 29,14 44,76 58,76 38,4 20,4" />
      <polygon points="17,52 41,52 37.5,40 20.5,40" />

      {/* ── N ── */}
      <polygon points="64,4 64,76 78,76 78,26 104,76 118,76 118,4 104,4 104,54 78,4" />

      {/* ── D ── */}
      <path d="M124,4 L124,76 L147,76 Q172,76 180,58 Q186,46 186,40 Q186,34 180,22 Q172,4 147,4 Z
               M138,16 L147,16 Q164,16 170,28 Q174,35 174,40 Q174,45 170,52 Q164,64 147,64 L138,64 Z" />

      {/* ── R ── */}
      <path d="M192,4 L192,76 L206,76 L206,46 L219,46 L237,76 L253,76 L233,44 Q246,38 250,28 Q254,18 247,10 Q240,4 222,4 Z
               M206,16 L222,16 Q232,16 235,23 Q238,28 235,35 Q232,42 222,42 L206,42 Z" />

      {/* ── I ── */}
      <rect x="260" y="4" width="13" height="72" />

      {/* ── T ── */}
      <polygon points="279,4 279,16 301,16 301,76 315,76 315,16 337,16 337,4" />

      {/* ── Z ── */}
      <polygon points="343,4 343,16 392,16 343,64 343,76 420,76 420,64 371,64 420,16 420,4" />
      {/* diagonal slash accent on Z */}
      <polygon points="408,4 420,4 420,16 408,4" />
    </svg>
  )
}
