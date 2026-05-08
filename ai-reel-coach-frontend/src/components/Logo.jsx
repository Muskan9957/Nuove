/**
 * Nuovve Logo — three overlapping pill shapes + wordmark
 *
 * Icon: 3 long pills fanning from a central overlap zone
 *   ViewBox 62×54  (ratio 1.148 → iconW = size * 1.148)
 *
 *   Orange  #F7931E  back   (8,47)→(50,3)   ~46° steep up-right
 *   Blue    #29B6F6  mid   (10,10)→(55,34)  ~28° down-right
 *   Pink    #F03852  front  (6,40)→(50,11)  ~33° up-right  [thickest]
 *
 *   All three cross near (30,23) creating a tight central overlap.
 *
 * Wordmark: "NUOVVE" — white on dark, navy on light
 *   Plus Jakarta Sans 900, uppercase, slight tracking
 */

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  // Icon aspect: viewBox 62×54 → ratio ≈ 1.148
  const iconH    = size
  const iconW    = Math.round(size * 1.148)
  const wordSize = Math.max(size * 0.80, 24)
  const gap      = Math.max(size * 0.20, 7)

  return (
    <div
      className={className}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* ── Icon: three long pills fanning from a central overlap ────
          ViewBox 62×54. Painter order: orange (back), blue, pink (front).

          Orange:  (8,47) → (50,3)   steep up-right  ~46°
          Blue:   (10,10) → (55,34)  down-right       ~28°
          Pink:    (6,40) → (50,11)  up-right         ~33°  [thickest, front]

          All three intersect near (30, 23) — tight central overlap zone.
      ─────────────────────────────────────────────────────────────── */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 62 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
        aria-hidden="true"
      >
        {/* Orange — back, steep diagonal */}
        <line
          x1="8"  y1="47"
          x2="50" y2="3"
          stroke="#F7931E"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Blue — middle, going right and slightly down */}
        <line
          x1="10" y1="10"
          x2="55" y2="34"
          stroke="#29B6F6"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Pink/coral — front, thickest, moderate up-right angle */}
        <line
          x1="6"  y1="40"
          x2="50" y2="11"
          stroke="#F03852"
          strokeWidth="16"
          strokeLinecap="round"
        />
      </svg>

      {/* ── Wordmark ─────────────────────────────────────────────────
          White on dark (default). Light-mode override via CSS class.
      ────────────────────────────────────────────────────────────── */}
      {showWordmark && (
        <span
          className="nuovve-wordmark"
          style={{
            fontFamily:    '"Plus Jakarta Sans", sans-serif',
            fontWeight:    900,
            fontSize:      `${wordSize}px`,
            lineHeight:    1,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color:         '#FFFFFF',
            whiteSpace:    'nowrap',
          }}
        >
          Nuovve
        </span>
      )}
    </div>
  )
}
