/**
 * Nuove Logo
 *
 * Icon     : Clapperboard (purple/cyan)
 * Wordmark : Bricolage Grotesque 800 — animated shimmer gradient,
 *            wide tracking, purple glow
 */
import { useState } from 'react'

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  const [uid] = useState(() => `vc${Math.random().toString(36).slice(2, 7)}`)

  const sP  = `${uid}-sp`
  const cLo = `${uid}-cl`
  const cUp = `${uid}-cu`

  const wordSize = Math.max(size * 0.95, 26)   /* script fonts render a touch smaller optically */
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

      {/* ── Clapperboard icon ──────────────────────────────────── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={sP}
            x="0" y="0" width="14" height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-48)"
          >
            <rect x="0" y="0" width="7" height="14" fill="rgba(0,0,0,0.26)" />
            <rect x="7" y="0" width="7" height="14" fill="rgba(255,255,255,0.09)" />
          </pattern>
          <clipPath id={cLo}>
            <rect x="5" y="32" width="90" height="14" />
          </clipPath>
          <clipPath id={cUp}>
            <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z" />
          </clipPath>
        </defs>

        {/* Body — purple */}
        <rect x="5" y="44" width="90" height="52" rx="5" fill="var(--logo-v2)" />
        <rect x="5" y="44" width="90" height="7"  rx="5" fill="rgba(255,255,255,0.18)" />

        {/* Lower clapper bar — cyan */}
        <rect x="5" y="32" width="90" height="14" rx="2" fill="var(--logo-v1)" />
        <rect x="5" y="32" width="90" height="14" fill={`url(#${sP})`} clipPath={`url(#${cLo})`} />
        <rect x="5" y="32" width="90" height="5"  rx="2" fill="rgba(255,255,255,0.22)" />
        <line x1="5" y1="46" x2="95" y2="46" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />

        {/* Upper clapper board — angled, cyan */}
        <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z" fill="var(--logo-v1)" />
        <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z" fill={`url(#${sP})`} clipPath={`url(#${cUp})`} />
        <path d="M 5 22 L 95 9 L 95 12 L 5 25 Z" fill="rgba(255,255,255,0.20)" />

        {/* Hinge pin */}
        <circle cx="10" cy="27" r="3.5" fill="var(--logo-shadow)" />
        <circle cx="10" cy="27" r="2"   fill="var(--logo-h1)" opacity="0.9" />

        {/* Play ▶ */}
        <path d="M 35 57 L 35 80 L 68 68.5 Z" fill="rgba(255,255,255,0.70)" />
      </svg>

      {/* ── Wordmark ───────────────────────────────────────────── */}
      {showWordmark && (
        <span
          className="nuove-wordmark"
          style={{
            fontFamily:           '"Dancing Script", cursive',
            fontWeight:           700,
            fontSize:             `${wordSize}px`,
            lineHeight:           1,
            letterSpacing:        '0.02em',
            whiteSpace:           'nowrap',
            background: 'linear-gradient(135deg, #00D4FF 0%, #FF2D8B 50%, #FFB800 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
            backgroundClip:       'text',
          }}
        >
          Nuove
        </span>
      )}
    </div>
  )
}
