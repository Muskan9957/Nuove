/**
 * Nuove Logo
 *
 * Icon     : Clapperboard — full gradient fills, rounded corners,
 *            diagonal stripe texture, crisp stroke outlines, drop-shadow glow
 * Wordmark : Dancing Script 700 — cyan→pink→amber gradient
 */
import { useState } from 'react'

export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  const [uid] = useState(() => `vc${Math.random().toString(36).slice(2, 7)}`)

  const gBody  = `${uid}-gb`
  const gBar   = `${uid}-gc`
  const gTop   = `${uid}-gt`
  const gPlay  = `${uid}-gp`
  const gGlow  = `${uid}-gg`
  const sP     = `${uid}-sp`
  const cLo    = `${uid}-cl`
  const cUp    = `${uid}-cu`
  const fDrop  = `${uid}-fd`

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
            <rect x="0" y="0" width="7" height="14" fill="rgba(0,0,0,0.22)" />
            <rect x="7" y="0" width="7" height="14" fill="rgba(255,255,255,0.07)" />
          </pattern>

          <clipPath id={cLo}>
            <rect x="5" y="32" width="90" height="14" rx="4" />
          </clipPath>
          <clipPath id={cUp}>
            <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z" />
          </clipPath>

          {/* Body — amber → magenta → violet */}
          <linearGradient id={gBody} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#F9A825" />
            <stop offset="30%"  stopColor="#F06292" />
            <stop offset="65%"  stopColor="#E040FB" />
            <stop offset="100%" stopColor="#7C4DFF" />
          </linearGradient>

          {/* Bars — neon cyan → electric indigo */}
          <linearGradient id={gBar} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00E5FF" />
            <stop offset="50%"  stopColor="#40C4FF" />
            <stop offset="100%" stopColor="#7C4DFF" />
          </linearGradient>

          <linearGradient id={gTop} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00E5FF" />
            <stop offset="55%"  stopColor="#29B6F6" />
            <stop offset="100%" stopColor="#7C4DFF" />
          </linearGradient>

          <linearGradient id={gPlay} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.60)" />
          </linearGradient>

          <linearGradient id={gGlow} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
            <stop offset="40%"  stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
          </linearGradient>

          {/* Drop-shadow — stronger so silhouette reads on any background */}
          <filter id={fDrop} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2"  floodColor="#000"    floodOpacity="0.40" />
            <feDropShadow dx="0" dy="3" stdDeviation="5"  floodColor="#C2185B" floodOpacity="0.55" />
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#7C4DFF" floodOpacity="0.40" />
          </filter>

        </defs>

        <g filter={`url(#${fDrop})`}>

          {/* ── Body ── */}
          <rect x="5" y="44" width="90" height="52" rx="12"
            fill={`url(#${gBody})`}
            stroke="rgba(255,255,255,0.30)" strokeWidth="1.5" />

          {/* inner shine */}
          <rect x="5" y="44" width="90" height="28" rx="12"
            fill={`url(#${gGlow})`} />

          {/* bottom shadow */}
          <rect x="5" y="88" width="90" height="8" rx="12"
            fill="rgba(0,0,0,0.18)" />

          {/* ── Lower clapper bar ── */}
          <rect x="5" y="32" width="90" height="14" rx="4"
            fill={`url(#${gBar})`}
            stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
          <rect x="5" y="32" width="90" height="14"
            fill={`url(#${sP})`} clipPath={`url(#${cLo})`} />
          <rect x="5" y="32" width="90" height="5" rx="4"
            fill="rgba(255,255,255,0.28)" />
          <line x1="5" y1="46" x2="95" y2="46"
            stroke="rgba(0,0,0,0.14)" strokeWidth="1" />

          {/* ── Upper angled board ── */}
          <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z"
            fill={`url(#${gTop})`}
            stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M 5 32 L 95 19 L 95 9 L 5 22 Z"
            fill={`url(#${sP})`} clipPath={`url(#${cUp})`} />
          <path d="M 5 22 L 95 9 L 95 12.5 L 5 25.5 Z"
            fill="rgba(255,255,255,0.30)" />
          <path d="M 5 29.5 L 95 16.5 L 95 19 L 5 32 Z"
            fill="rgba(0,0,0,0.12)" />

          {/* ── Hinge pin ── */}
          <circle cx="10" cy="27" r="4"   fill="rgba(0,0,0,0.40)" />
          <circle cx="10" cy="27" r="2.5" fill={`url(#${gBar})`} opacity="0.95" />
          <circle cx="9"  cy="26" r="1"   fill="rgba(255,255,255,0.75)" />

          {/* ── Play ▶ ── */}
          <path d="M 36 56 L 36 81 L 70 68.5 Z"
            fill={`url(#${gPlay})`} />

        </g>
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
