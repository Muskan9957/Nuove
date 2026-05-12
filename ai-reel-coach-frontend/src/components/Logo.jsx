/**
 * Nuove Logo
 *
 * Icon     : Clapperboard — Instagram-style clean gradient fills,
 *            crisp stroke edges, no glow.
 * Wordmark : Dancing Script 700 — cyan→pink→amber gradient
 */
import { useState } from 'react'

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  const [uid] = useState(() => `vc${Math.random().toString(36).slice(2, 7)}`)

  const gBody = `${uid}-gb`
  const gBar  = `${uid}-gc`
  const gTop  = `${uid}-gt`
  const sP    = `${uid}-sp`
  const cLo   = `${uid}-cl`
  const cUp   = `${uid}-cu`

  const wordSize = Math.max(size * 0.95, 26)
  const gap      = Math.max(size * 0.20, 7)

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap, userSelect: 'none', flexShrink: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <defs>

          {/* Diagonal stripe texture */}
          <pattern
            id={sP}
            x="0" y="0" width="14" height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-48)"
          >
            <rect x="0" y="0" width="7" height="14" fill="rgba(0,0,0,0.18)" />
            <rect x="7" y="0" width="7" height="14" fill="rgba(255,255,255,0.10)" />
          </pattern>

          <clipPath id={cLo}>
            <rect x="5" y="32" width="90" height="14" rx="4" />
          </clipPath>
          <clipPath id={cUp}>
            <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z" />
          </clipPath>

          {/* Body — amber → rose → violet (Instagram warmth) */}
          <linearGradient id={gBody} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#FFDC80" />
            <stop offset="15%"  stopColor="#FCAF45" />
            <stop offset="35%"  stopColor="#F77737" />
            <stop offset="55%"  stopColor="#F56040" />
            <stop offset="70%"  stopColor="#E1306C" />
            <stop offset="85%"  stopColor="#C13584" />
            <stop offset="100%" stopColor="#833AB4" />
          </linearGradient>

          {/* Bars — cyan → indigo (clean, cool contrast to warm body) */}
          <linearGradient id={gBar} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00C8FF" />
            <stop offset="55%"  stopColor="#5B8DEF" />
            <stop offset="100%" stopColor="#833AB4" />
          </linearGradient>

          <linearGradient id={gTop} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00C8FF" />
            <stop offset="55%"  stopColor="#5B8DEF" />
            <stop offset="100%" stopColor="#833AB4" />
          </linearGradient>

        </defs>

        {/* ── Body ── */}
        <rect x="5" y="44" width="90" height="52" rx="12"
          fill={`url(#${gBody})`}
          stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        {/* top shine */}
        <rect x="5" y="44" width="90" height="22" rx="12"
          fill="rgba(255,255,255,0.14)" />

        {/* ── Lower clapper bar ── */}
        <rect x="5" y="32" width="90" height="14" rx="4"
          fill={`url(#${gBar})`}
          stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <rect x="5" y="32" width="90" height="14"
          fill={`url(#${sP})`} clipPath={`url(#${cLo})`} />
        <rect x="5" y="32" width="90" height="5" rx="4"
          fill="rgba(255,255,255,0.25)" />
        <line x1="5" y1="46" x2="95" y2="46"
          stroke="rgba(255,255,255,0.20)" strokeWidth="1" />

        {/* ── Upper angled board ── */}
        <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z"
          fill={`url(#${gTop})`}
          stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z"
          fill={`url(#${sP})`} clipPath={`url(#${cUp})`} />
        {/* top edge shine */}
        <path d="M 5 22 L 95 9 L 95 12.5 L 5 25.5 Z"
          fill="rgba(255,255,255,0.28)" />

        {/* ── Hinge pin ── */}
        <circle cx="10" cy="27" r="4"   fill="rgba(0,0,0,0.25)" />
        <circle cx="10" cy="27" r="2.5" fill="rgba(255,255,255,0.90)" />
        <circle cx="9"  cy="26" r="1"   fill="rgba(255,255,255,0.70)" />

        {/* ── Play ▶ ── */}
        <path d="M 36 56 L 36 81 L 70 68.5 Z"
          fill="rgba(255,255,255,0.95)" />

      </svg>

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
            background:           'linear-gradient(135deg, #00D4FF 0%, #FF2D8B 50%, #FFB800 100%)',
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
