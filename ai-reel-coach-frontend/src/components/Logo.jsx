/**
 * Nuovve Logo
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

  const wordSize = Math.max(size * 0.90, 24)
  const gap      = Math.max(size * 0.22, 8)

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
      {/* ── Keyframes injected once alongside the component ─────── */}
      <style>{`
        @keyframes nuovveShimmer {
          0%   { background-position: 0%   50%; }
          100% { background-position: 200% 50%; }
        }
        .nuovve-wm {
          font-family:   'Bricolage Grotesque', sans-serif;
          font-weight:   800;
          text-transform: uppercase;
          white-space:   nowrap;
          letter-spacing: 0.13em;
          line-height:   1;
          background: linear-gradient(
            90deg,
            #00CFFF  0%,
            #7B5CF0 30%,
            #F040A8 55%,
            #7B5CF0 80%,
            #00CFFF 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: nuovveShimmer 5s linear infinite;
          filter: drop-shadow(0 0 10px rgba(123,92,240,0.55))
                  drop-shadow(0 0 22px rgba(240,64,168,0.22));
        }
      `}</style>

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
          className="nuovve-wm"
          style={{ fontSize: `${wordSize}px` }}
        >
          Nuovve
        </span>
      )}
    </div>
  )
}
