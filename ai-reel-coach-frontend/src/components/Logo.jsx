/**
 * Nuovve Logo — exact match of reference
 *
 * Icon: 3 overlapping pills (SVG lines with round caps)
 *   Orange  #F7931E  back  layer — long diagonal bottom-left → upper-right
 *   Blue    #29B6F6  mid   layer — going upper-left → lower-right (rightward)
 *   Pink    #F03852  front layer — shorter, diagonal, thickest, most prominent
 *
 * Wordmark: "NUOVVE" — white on dark, navy on light
 *   Plus Jakarta Sans 900, uppercase, slight tracking
 */

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  // Icon aspect: viewBox 58×52 → ratio ≈ 1.115
  const iconH    = size
  const iconW    = Math.round(size * 1.115)
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
      {/* ── Icon: three pills ────────────────────────────────────
          All coordinates are within the 58×52 viewBox.
          Painter order (back→front): orange, blue, pink.

          Orange: (3,43) → (31,9)   diagonal up-right   ~−47°
          Blue:   (19,8) → (54,27)  rightward + down     ~+27°
          Pink:   (6,29) → (32,11)  diagonal up-right   ~−34°  [front, thickest]
      ─────────────────────────────────────────────────────── */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 58 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
        aria-hidden="true"
      >
        {/* Orange — back */}
        <line
          x1="3"  y1="43"
          x2="31" y2="9"
          stroke="#F7931E"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Blue — middle */}
        <line
          x1="19" y1="8"
          x2="54" y2="27"
          stroke="#29B6F6"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Pink/coral — front, thickest */}
        <line
          x1="6"  y1="29"
          x2="32" y2="11"
          stroke="#F03852"
          strokeWidth="17"
          strokeLinecap="round"
        />
      </svg>

      {/* ── Wordmark ─────────────────────────────────────────────
          White on dark (default). Light-mode override via CSS class.
      ─────────────────────────────────────────────────────── */}
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
