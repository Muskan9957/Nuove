/**
 * Nuove Logo
 *
 * Icon     : Gradient rounded-square container (Instagram-style)
 *            with white clapperboard + play ▶ inside.
 *            Clear defined border at any size.
 * Wordmark : Dancing Script 700 — cyan→pink→amber gradient
 */
import { useState } from 'react'

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  const [uid] = useState(() => `vc${Math.random().toString(36).slice(2, 7)}`)

  const gBg   = `${uid}-bg`   // container background gradient
  const fDrop = `${uid}-fd`   // drop-shadow filter
  const sP    = `${uid}-sp`   // stripe pattern
  const cLo   = `${uid}-cl`   // clip: lower bar
  const cUp   = `${uid}-cu`   // clip: upper board

  const wordSize = Math.max(size * 0.95, 26)
  const gap      = Math.max(size * 0.20, 7)

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap, userSelect: 'none', flexShrink: 0 }}
    >

      {/* ── Icon ──────────────────────────────────────────────── */}
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

          {/* ── Diagonal stripe texture ── */}
          <pattern
            id={sP}
            x="0" y="0" width="14" height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-48)"
          >
            <rect x="0" y="0" width="7"  height="14" fill="rgba(0,0,0,0.20)" />
            <rect x="7" y="0" width="7"  height="14" fill="rgba(255,255,255,0.06)" />
          </pattern>

          {/* ── Clip paths for stripes ── */}
          <clipPath id={cLo}>
            <rect x="12" y="36" width="76" height="14" rx="3" />
          </clipPath>
          <clipPath id={cUp}>
            <path d="M 12 36 L 88 22 L 88 11 L 12 25 Z" />
          </clipPath>

          {/* ── Container gradient — amber → magenta → violet ── */}
          <linearGradient id={gBg} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#F9A825" />
            <stop offset="28%"  stopColor="#F06292" />
            <stop offset="62%"  stopColor="#E040FB" />
            <stop offset="100%" stopColor="#7C4DFF" />
          </linearGradient>

          {/* ── Drop shadow ── */}
          <filter id={fDrop} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#E040FB" floodOpacity="0.50" />
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#7C4DFF" floodOpacity="0.35" />
          </filter>

        </defs>

        <g filter={`url(#${fDrop})`}>

          {/* ── Rounded-square container ── */}
          <rect x="3" y="3" width="94" height="94" rx="22" fill={`url(#${gBg})`} />
          {/* top highlight */}
          <rect x="3" y="3" width="94" height="50" rx="22" fill="rgba(255,255,255,0.13)" />
          {/* bottom vignette */}
          <rect x="3" y="80" width="94" height="17" rx="22" fill="rgba(0,0,0,0.18)" />

          {/* ── Lower clapper bar — white ── */}
          <rect x="12" y="36" width="76" height="14" rx="3"
            fill="rgba(255,255,255,0.93)" />
          <rect x="12" y="36" width="76" height="14"
            fill={`url(#${sP})`} clipPath={`url(#${cLo})`} />
          {/* shine */}
          <rect x="12" y="36" width="76" height="5" rx="3"
            fill="rgba(255,255,255,0.45)" />
          {/* divider */}
          <line x1="12" y1="50" x2="88" y2="50"
            stroke="rgba(0,0,0,0.10)" strokeWidth="1" />

          {/* ── Upper angled board — white ── */}
          <path d="M 12 36 L 88 22 L 88 11 L 12 25 Z"
            fill="rgba(255,255,255,0.88)" />
          <path d="M 12 36 L 88 22 L 88 11 L 12 25 Z"
            fill={`url(#${sP})`} clipPath={`url(#${cUp})`} />
          {/* top shine */}
          <path d="M 12 25 L 88 11 L 88 14.5 L 12 28.5 Z"
            fill="rgba(255,255,255,0.50)" />
          {/* bottom shadow */}
          <path d="M 12 33.5 L 88 19.5 L 88 22 L 12 36 Z"
            fill="rgba(0,0,0,0.10)" />

          {/* ── Hinge pin ── */}
          <circle cx="17" cy="30.5" r="4.5" fill="rgba(0,0,0,0.30)" />
          <circle cx="17" cy="30.5" r="2.8" fill="rgba(255,255,255,0.92)" />
          <circle cx="16" cy="29.5" r="1.1" fill="rgba(255,255,255,0.80)" />

          {/* ── Play ▶ ── */}
          <path d="M 36 56 L 36 80 L 70 68 Z"
            fill="rgba(255,255,255,0.95)" />

        </g>
      </svg>

      {/* ── Wordmark ────────────────────────────────────────── */}
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
