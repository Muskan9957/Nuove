/**
 * Nuove Logo
 *
 * Icon     : Clapperboard — full gradient fills, rounded corners,
 *            diagonal stripe texture, drop-shadow glow
 * Wordmark : Dancing Script 700 — cyan→pink→amber gradient
 */
import { useState } from 'react'

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  const [uid] = useState(() => `vc${Math.random().toString(36).slice(2, 7)}`)

  /* unique IDs so multiple logos on a page don't clash */
  const gBody  = `${uid}-gb`   // body gradient
  const gBar   = `${uid}-gc`   // clapper bar gradient
  const gTop   = `${uid}-gt`   // upper board gradient
  const gPlay  = `${uid}-gp`   // play icon gradient
  const gGlow  = `${uid}-gg`   // inner-glow overlay
  const sP     = `${uid}-sp`   // stripe pattern
  const cLo    = `${uid}-cl`   // clip: lower bar
  const cUp    = `${uid}-cu`   // clip: upper board
  const fDrop  = `${uid}-fd`   // drop-shadow filter

  const wordSize = Math.max(size * 0.95, 26)
  const gap      = Math.max(size * 0.20, 7)

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap, userSelect: 'none', flexShrink: 0 }}
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

          {/* ── Stripe texture ── */}
          <pattern
            id={sP}
            x="0" y="0" width="14" height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-48)"
          >
            <rect x="0" y="0" width="7" height="14" fill="rgba(0,0,0,0.22)" />
            <rect x="7" y="0" width="7" height="14" fill="rgba(255,255,255,0.07)" />
          </pattern>

          {/* ── Clip paths ── */}
          <clipPath id={cLo}>
            <rect x="5" y="32" width="90" height="14" rx="4" />
          </clipPath>
          <clipPath id={cUp}>
            <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z" />
          </clipPath>

          {/* ── Body gradient — violet → fuchsia → hot-pink ── */}
          <linearGradient id={gBody} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#7C3AED" />
            <stop offset="45%"  stopColor="#A855F7" />
            <stop offset="75%"  stopColor="#DB2777" />
            <stop offset="100%" stopColor="#FF2D8B" />
          </linearGradient>

          {/* ── Clapper bar — cyan → electric blue ── */}
          <linearGradient id={gBar} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00D4FF" />
            <stop offset="55%"  stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>

          {/* ── Upper angled board — cyan → sky ── */}
          <linearGradient id={gTop} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#06B6D4" />
            <stop offset="60%"  stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* ── Play icon — white shimmer ── */}
          <linearGradient id={gPlay} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
          </linearGradient>

          {/* ── Inner glow overlay on body ── */}
          <linearGradient id={gGlow} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
            <stop offset="40%"  stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
          </linearGradient>

          {/* ── Drop-shadow filter ── */}
          <filter id={fDrop} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3"   floodColor="#7C3AED" floodOpacity="0.50" />
            <feDropShadow dx="0" dy="0" stdDeviation="6"   floodColor="#00D4FF" floodOpacity="0.30" />
          </filter>

        </defs>

        <g filter={`url(#${fDrop})`}>

          {/* ── Body ─────────────────────────────────────────── */}
          <rect x="5" y="44" width="90" height="52" rx="12"
            fill={`url(#${gBody})`} />

          {/* inner-top shine */}
          <rect x="5" y="44" width="90" height="28" rx="12"
            fill={`url(#${gGlow})`} />

          {/* subtle bottom shadow line */}
          <rect x="5" y="88" width="90" height="8" rx="12"
            fill="rgba(0,0,0,0.18)" />

          {/* ── Lower clapper bar ────────────────────────────── */}
          <rect x="5" y="32" width="90" height="14" rx="4"
            fill={`url(#${gBar})`} />
          <rect x="5" y="32" width="90" height="14"
            fill={`url(#${sP})`} clipPath={`url(#${cLo})`} />
          {/* top shine */}
          <rect x="5" y="32" width="90" height="5" rx="4"
            fill="rgba(255,255,255,0.28)" />
          {/* divider line */}
          <line x1="5" y1="46" x2="95" y2="46"
            stroke="rgba(0,0,0,0.14)" strokeWidth="1" />

          {/* ── Upper angled board ───────────────────────────── */}
          <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z"
            fill={`url(#${gTop})`} />
          <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z"
            fill={`url(#${sP})`} clipPath={`url(#${cUp})`} />
          {/* top edge shine */}
          <path d="M 5 22 L 95 9 L 95 12.5 L 5 25.5 Z"
            fill="rgba(255,255,255,0.30)" />
          {/* bottom edge shadow */}
          <path d="M 5 29.5 L 95 16.5 L 95 19 L 5 32 Z"
            fill="rgba(0,0,0,0.12)" />

          {/* ── Hinge pin ────────────────────────────────────── */}
          <circle cx="10" cy="27" r="4" fill="rgba(0,0,0,0.35)" />
          <circle cx="10" cy="27" r="2.5"
            fill={`url(#${gBar})`} opacity="0.95" />
          {/* pin highlight */}
          <circle cx="9" cy="26" r="1"
            fill="rgba(255,255,255,0.70)" />

          {/* ── Play ▶ ───────────────────────────────────────── */}
          <path d="M 36 56 L 36 81 L 70 68.5 Z"
            fill={`url(#${gPlay})`} />

        </g>
      </svg>

      {/* ── Wordmark ─────────────────────────────────────────── */}
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
