/**
 * Nuovve Logo — replicates the three-pill icon + bold uppercase wordmark
 *
 * Icon  : Three overlapping capsule/pill shapes — orange, pink, blue
 *         Layered: orange (back) → blue (mid) → pink (front)
 *         Colors are vivid and work on both dark and light backgrounds
 *
 * Wordmark : "NUOVVE" in Plus Jakarta Sans Black (900)
 *   dark  mode → warm gold  #C9A844  (readable on dark navy/black)
 *   light mode → deep navy  #0F1535  (readable on white/light)
 *   Controlled via --logo-word CSS variable (defined in index.css)
 */
import { useState } from 'react'

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  const [uid] = useState(() => `nv${Math.random().toString(36).slice(2, 7)}`)

  // Icon viewBox is 66×54 — preserve that aspect ratio
  const iconH = size
  const iconW = Math.round(size * (66 / 54))
  const wordSize = Math.max(size * 0.76, 24)
  const gap = Math.max(size * 0.22, 7)

  return (
    <div
      className={className}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap,
        userSelect: 'none',
      }}
    >
      {/* ── Three-pill icon ───────────────────────────────────────── */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 66 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          {/* Subtle highlight strips for 3-D pill depth */}
          <linearGradient id={`${uid}-go`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.30)" />
            <stop offset="50%"  stopColor="rgba(255,255,255,0.00)" />
          </linearGradient>
          <linearGradient id={`${uid}-gp`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.28)" />
            <stop offset="50%"  stopColor="rgba(255,255,255,0.00)" />
          </linearGradient>
          <linearGradient id={`${uid}-gb`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.28)" />
            <stop offset="50%"  stopColor="rgba(255,255,255,0.00)" />
          </linearGradient>
        </defs>

        {/* ── Layer 1 — Orange pill (back) ───────────────────── */}
        {/* Long axis: bottom-left → upper-right, ~−42° */}
        <g transform="rotate(-42, 20, 35)">
          <rect x="0" y="28" width="40" height="14" rx="7"
            fill="#F7931E" />
          <rect x="0" y="28" width="40" height="14" rx="7"
            fill={`url(#${uid}-go)`} />
        </g>

        {/* ── Layer 2 — Blue/cyan pill (middle) ─────────────── */}
        {/* Long axis: lower-left → upper-right, ~+32° */}
        <g transform="rotate(32, 40, 21)">
          <rect x="20" y="14" width="40" height="14" rx="7"
            fill="#00B8D9" />
          <rect x="20" y="14" width="40" height="14" rx="7"
            fill={`url(#${uid}-gb)`} />
        </g>

        {/* ── Layer 3 — Pink/magenta pill (front) ───────────── */}
        {/* Long axis: roughly horizontal, slight ~−10° tilt */}
        <g transform="rotate(-10, 28, 27)">
          <rect x="6" y="20" width="44" height="14" rx="7"
            fill="#E91E8C" />
          <rect x="6" y="20" width="44" height="14" rx="7"
            fill={`url(#${uid}-gp)`} />
        </g>
      </svg>

      {/* ── Wordmark — NUOVVE ─────────────────────────────────────
          Plus Jakarta Sans 900, uppercase.
          --logo-word switches between gold (dark) and navy (light)
          via index.css variables — no JS theme detection needed.
      ────────────────────────────────────────────────────────── */}
      {showWordmark && (
        <span
          style={{
            fontFamily:    '"Plus Jakarta Sans", sans-serif',
            fontWeight:    900,
            fontSize:      `${wordSize}px`,
            lineHeight:    1,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            color:         'var(--logo-word)',
          }}
        >
          Nuovve
        </span>
      )}
    </div>
  )
}
