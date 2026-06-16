import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useLang } from '../i18n.jsx'
import { useAuth } from '../store'
import { useToast } from '../components/Toast'
import { api } from '../api'
import PasswordChecklist, { isPasswordValid } from '../components/PasswordChecklist'
import ThemeToggle from '../components/ThemeToggle'

// Known webmail providers → direct inbox link (jump straight to the user's mail)
const PROVIDER_URLS = {
  'gmail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'googlemail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'outlook.com': 'https://outlook.live.com/mail/0/',
  'hotmail.com': 'https://outlook.live.com/mail/0/',
  'live.com': 'https://outlook.live.com/mail/0/',
  'yahoo.com': 'https://mail.yahoo.com/',
  'icloud.com': 'https://www.icloud.com/mail',
  'me.com': 'https://www.icloud.com/mail',
  'proton.me': 'https://mail.proton.me/u/0/inbox',
  'protonmail.com': 'https://mail.proton.me/u/0/inbox',
}
const inboxUrlFor = (email) => PROVIDER_URLS[(email.split('@')[1] || '').toLowerCase()] || null

/* ─── Google Fonts ───────────────────────────────────────────────── */
if (!document.getElementById('nuove-fonts')) {
  const link = document.createElement('link')
  link.id   = 'nuove-fonts'
  link.rel  = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap'
  document.head.appendChild(link)
}

/* ─── SVG Icons ───────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)
const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
)
const YouTubeIcon = () => (
  <svg width="20" height="14" viewBox="0 0 24 17" fill="white" aria-hidden="true">
    <path d="M23.495 2.205a3.02 3.02 0 0 0-2.122-2.136C19.548 0 12 0 12 0S4.452 0 2.627.069a3.02 3.02 0 0 0-2.122 2.136C0 4.04 0 8.667 0 8.667s0 4.627.505 6.462a3.02 3.02 0 0 0 2.122 2.136C4.452 17.334 12 17.334 12 17.334s7.548 0 9.373-.069a3.02 3.02 0 0 0 2.122-2.136C24 13.294 24 8.667 24 8.667s0-4.627-.505-6.462zM9.545 12.001V5.333l6.273 3.334-6.273 3.334z"/>
  </svg>
)
const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const ChevronLeft  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
const ChevronRight = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>

/* ─── Lang Flip ──────────────────────────────────────────────────── */
function LangFlip() {
  const { lang, setLanguage } = useLang()
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 99, padding: 3 }}>
      {[{ code: 'en', label: 'EN' }, { code: 'hi', label: 'हिं' }].map(o => {
        const active = lang === o.code
        return (
          <button key={o.code} type="button" onClick={() => !active && setLanguage(o.code)}
            style={{ border: 'none', cursor: active ? 'default' : 'pointer', padding: '4px 11px', borderRadius: 99, background: active ? 'linear-gradient(135deg,#00D4FF,#FF2D8B)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', transition: 'all 0.18s', fontFamily: "'DM Sans', var(--font-body)" }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Smooth Video Hero ,  A/B Buffer ─────────────────────────────── */
// Only 2 video elements exist at any time. We alternate between them
// (like double-buffering in graphics) so the browser only ever needs
// to handle 2 videos, not all 4 simultaneously.
const VIDEOS    = ['/videos/hero1.mp4', '/videos/hero2.mp4', '/videos/hero3.mp4', '/videos/hero4.mp4']
const START_AT  = 0      // videos are now pre-trimmed by FFmpeg!
const SHOW_FOR  = 5000   // ms each clip is visible
const FADE_TIME = 1200   // ms crossfade duration

function HeroVideo() {
  // which slot (0=A, 1=B) is currently ON TOP (visible)
  const [topSlot, setTopSlot]   = useState(0)
  const [ready,   setReady]     = useState(false)
  const vidIdx  = useRef([0, 1])   // vidIdx[slot] = which VIDEOS[] index is loaded in that slot
  const slotRef = useRef([null, null])
  const timer   = useRef(null)

  const playFrom = (el, t = START_AT) => {
    if (!el) return
    el.currentTime = t
    el.play().catch(() => {})
  }

  // Load a video into a slot and start playing it silently until needed
  const loadIntoSlot = (slot, videoIndex) => {
    const el = slotRef.current[slot]
    if (!el) return
    vidIdx.current[slot] = videoIndex
    el.src = VIDEOS[videoIndex]
    el.load()
    // Start playing immediately so it's buffered (it's invisible until we fade it in)
    el.addEventListener('canplay', function handler() {
      el.removeEventListener('canplay', handler)
      playFrom(el)
    })
  }

  useEffect(() => {
    // Initial setup: load clip 0 into slot A, clip 1 into slot B
    const slotA = slotRef.current[0]
    const slotB = slotRef.current[1]

    // Slot A ,  visible first
    if (slotA) {
      slotA.src = VIDEOS[0]
      slotA.load()
      slotA.addEventListener('canplay', function h() {
        slotA.removeEventListener('canplay', h)
        playFrom(slotA)
        setReady(true)
      })
    }

    // Slot B ,  preload clip 1 silently
    if (slotB) {
      slotB.src = VIDEOS[1]
      slotB.load()
      slotB.addEventListener('canplay', function h() {
        slotB.removeEventListener('canplay', h)
        playFrom(slotB)
      })
    }

    let currentVideoIdx = 0

    timer.current = setInterval(() => {
      currentVideoIdx = (currentVideoIdx + 1) % VIDEOS.length
      const nextVideoIdx = (currentVideoIdx + 1) % VIDEOS.length

      // The slot that was HIDDEN becomes the new TOP (it's already playing)
      setTopSlot(prev => {
        const newTop = prev === 0 ? 1 : 0     // flip which slot is on top
        const hiddenSlot = prev                 // the old top becomes hidden
        // Load the NEXT video into the now-hidden slot so it's ready
        setTimeout(() => loadIntoSlot(hiddenSlot, nextVideoIdx), FADE_TIME + 500)
        return newTop
      })
    }, SHOW_FOR)

    return () => clearInterval(timer.current)
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', background: '#0a0a0a' }}>
      {[0, 1].map(slot => (
        <video
          key={slot}
          ref={el => slotRef.current[slot] = el}
          muted playsInline loop
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: slot === topSlot && ready ? 1 : 0,
            transition: `opacity ${FADE_TIME}ms ease-in-out`,
            willChange: 'opacity',
          }}
        />
      ))}
      {/* Gradient overlay for text legibility */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.50) 55%, rgba(0,0,0,0.65) 100%)', borderRadius: 'inherit' }} />
    </div>
  )
}

/* ─── Feature Carousel ───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '✍️',
    color: '#00D4FF',
    number: '01',
    titleKey: 'landing_feat_script_title',
    descKey: 'landing_feat_script_desc',
    orbs: ['🎬', '📖', '📣'],
  },
  {
    icon: '📈',
    color: '#FFB800',
    number: '02',
    titleKey: 'landing_feat_trends_title',
    descKey: 'landing_feat_trends_desc',
    orbs: ['#️⃣', '🔥', '📊'],
  },
  {
    icon: '🎬',
    color: '#A8FF3C',
    number: '03',
    titleKey: 'landing_feat_tele_title',
    descKey: 'landing_feat_tele_desc',
    orbs: ['📱', '📷', '✂️'],
  },
  {
    icon: '⇄',
    color: '#A855F7',
    number: '04',
    titleKey: 'landing_feat_cross_title',
    descKey: 'landing_feat_cross_desc',
    orbs: ['▶', '📲', '✓'],
  },
  {
    icon: '🏷️',
    color: '#FF2D8B',
    number: '05',
    titleKey: 'landing_feat_captions_title',
    descKey: 'landing_feat_captions_desc',
    orbs: ['📝', '#️⃣', '✨'],
  },
  {
    icon: '📂',
    color: '#00D4FF',
    number: '06',
    titleKey: 'landing_feat_templates_title',
    descKey: 'landing_feat_templates_desc',
    orbs: ['💾', '📎', '📚'],
  },
]

/* ─── Animated Feature Visual ─────────────────────────────────────── */
function FeatureVisual({ feature, exiting }) {
  const orbPositions = [
    { x: '20%', y: '25%', size: 52, dur: 3.2, delay: 0.1 },
    { x: '75%', y: '18%', size: 46, dur: 2.8, delay: 0.25 },
    { x: '15%', y: '70%', size: 44, dur: 3.6, delay: 0 },
  ]
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 220 }}>
      {/* Outer glow ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${feature.color}22 0%, transparent 70%)`,
        animation: 'pulseRingFC 2.8s ease-in-out infinite',
        opacity: exiting ? 0 : 1, transition: 'opacity 0.3s',
      }} />
      {/* Inner ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 110, height: 110, borderRadius: '50%',
        border: `1.5px dashed ${feature.color}45`,
        animation: 'spinSlowFC 18s linear infinite',
        opacity: exiting ? 0 : 1, transition: 'opacity 0.3s',
      }} />

      {/* Central icon */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${exiting ? 0.5 : 1})`,
        fontSize: '3.8rem',
        filter: `drop-shadow(0 0 28px ${feature.color}90)`,
        animation: 'floatYFC 3s ease-in-out infinite',
        opacity: exiting ? 0 : 1,
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 2, userSelect: 'none',
      }}>
        {feature.icon}
      </div>

      {/* Orbiting mini icons */}
      {orbPositions.map((orb, i) => (
        <div key={i} style={{
          position: 'absolute', left: orb.x, top: orb.y,
          transform: `translate(-50%, -50%) scale(${exiting ? 0.3 : 1})`,
          width: orb.size, height: orb.size,
          borderRadius: '50%',
          background: `${feature.color}18`,
          border: `1px solid ${feature.color}40`,
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${orb.size * 0.42}px`,
          boxShadow: `0 6px 24px ${feature.color}25`,
          animation: `floatYFC ${orb.dur}s ease-in-out infinite ${orb.delay}s`,
          opacity: exiting ? 0 : 1,
          transition: `all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.07}s`,
          userSelect: 'none',
        }}>
          {feature.orbs[i]}
        </div>
      ))}

      {/* SVG dashed connecting lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: exiting ? 0 : 0.18, transition: 'opacity 0.3s' }} viewBox="0 0 400 280" preserveAspectRatio="xMidYMid meet">
        <line x1="200" y1="140" x2="80" y2="70" stroke={feature.color} strokeWidth="1.2" strokeDasharray="5 5" />
        <line x1="200" y1="140" x2="300" y2="50" stroke={feature.color} strokeWidth="1.2" strokeDasharray="5 5" />
        <line x1="200" y1="140" x2="60" y2="196" stroke={feature.color} strokeWidth="1.2" strokeDasharray="5 5" />
      </svg>
    </div>
  )
}

function FeatureCarousel() {
  const { t } = useLang()
  const [idx, setIdx]         = useState(0)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)

  const goTo = (n) => {
    if (exiting) return
    clearInterval(timerRef.current)
    setExiting(true)
    setTimeout(() => {
      setIdx(n)
      setExiting(false)
      timerRef.current = setInterval(() => goTo((n + 1) % FEATURES.length), 5500)
    }, 320)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx(i => (i + 1) % FEATURES.length)
    }, 5500)
    return () => clearInterval(timerRef.current)
  }, [])

  const prev = () => goTo(idx === 0 ? FEATURES.length - 1 : idx - 1)
  const next = () => goTo((idx + 1) % FEATURES.length)
  const f    = FEATURES[idx]

  return (
    <div>
      {/* ── CSS keyframe animations ── */}
      <style>{`
        @keyframes pulseRingFC {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.55; }
          50%       { transform: translate(-50%,-50%) scale(1.35); opacity: 0.12; }
        }
        @keyframes spinSlowFC {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes floatYFC {
          0%, 100% { transform: translate(-50%,-50%) translateY(0px); }
          50%       { transform: translate(-50%,-50%) translateY(-14px); }
        }
        .feat-tab-btn { transition: all 0.25s ease !important; }
        .feat-tab-btn:hover { opacity: 0.9 !important; background-color: rgba(255,255,255,0.04) !important; }
        
        .feature-grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          position: relative;
          z-index: 1;
        }
        @media (min-width: 641px) {
          .feature-grid-container {
            height: 380px;
          }
        }
      `}</style>

      {/* ── Main Card ── */}
      <div style={{
        borderRadius: 24,
        overflow: 'hidden',
        background: 'var(--surface)',
        border: `1px solid ${f.color}35`,
        boxShadow: `0 24px 60px rgba(0,0,0,0.25), 0 0 0 1px ${f.color}15, inset 0 1px 0 rgba(255,255,255,0.08)`,
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        position: 'relative',
      }}>

        {/* Full-card watermark number */}
        <div style={{
          position: 'absolute', top: -20, right: -10, zIndex: 0,
          fontFamily: "'Fraunces', serif", fontWeight: 900,
          fontSize: 'clamp(9rem, 20vw, 18rem)',
          color: `${f.color}05`,
          letterSpacing: '-0.05em', userSelect: 'none', lineHeight: 1,
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.3s ease, color 0.5s ease',
          pointerEvents: 'none',
        }}>
          {f.number}
        </div>

        {/* ── Two-column interior ── */}
        <div className="feature-grid-container">

          {/* LEFT ,  text */}
          <div style={{
            padding: 'clamp(28px, 4vw, 40px)',
            background: `linear-gradient(145deg, ${f.color}15 0%, rgba(255,255,255,0.02) 100%)`,
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            transition: 'background 0.6s ease',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* Flex wrapper to group text at top and push controls to bottom */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Feature badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              width: 'fit-content', padding: '6px 14px', borderRadius: 99,
              background: `${f.color}15`, border: `1px solid ${f.color}35`,
              fontSize: '0.72rem', fontWeight: 700, color: f.color,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: "'DM Sans', sans-serif",
              opacity: exiting ? 0 : 1,
              transform: exiting ? 'translateY(-10px)' : 'translateY(0)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <span>{f.icon}</span> Feature {f.number}
            </div>

            {/* Title */}
            <h3 style={{
              margin: 0, fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 800, fontSize: 'clamp(1.9rem, 3.5vw, 2.9rem)',
              color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1,
              opacity: exiting ? 0 : 1,
              transform: exiting ? 'translateY(22px)' : 'translateY(0)',
              transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.05s',
            }}>
              {t(f.titleKey) || f.titleKey}
            </h3>

            {/* Description */}
            <p style={{
              margin: 0, fontFamily: "'DM Sans', sans-serif",
              fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 380,
              opacity: exiting ? 0 : 1,
              transform: exiting ? 'translateY(22px)' : 'translateY(0)',
              transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
            }}>
              {t(f.descKey) || f.descKey}
            </p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button onClick={prev} aria-label="Previous feature" style={{
                width: 44, height: 44, borderRadius: '50%',
                border: `1px solid ${f.color}35`, background: `${f.color}10`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: f.color, transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = `${f.color}28`; e.currentTarget.style.transform = 'scale(1.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = `${f.color}10`; e.currentTarget.style.transform = 'scale(1)' }}>
                <ChevronLeft />
              </button>
              <button onClick={next} aria-label="Next feature" style={{
                width: 44, height: 44, borderRadius: '50%',
                border: `1px solid ${f.color}35`, background: `${f.color}10`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: f.color, transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = `${f.color}28`; e.currentTarget.style.transform = 'scale(1.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = `${f.color}10`; e.currentTarget.style.transform = 'scale(1)' }}>
                <ChevronRight />
              </button>
            </div>
          </div>

          {/* RIGHT ,  animated orbital visual showcase */}
          <div style={{
            position: 'relative',
            background: `radial-gradient(ellipse at 55% 40%, ${f.color}18 0%, transparent 65%), var(--surface2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', minHeight: 280,
            transition: 'background 0.6s ease',
          }}>
            {/* Dot grid pattern */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: `radial-gradient(circle, ${f.color}35 1px, transparent 1px)`,
              backgroundSize: '28px 28px', opacity: 0.3,
              transition: 'all 0.5s ease',
            }} />
            <FeatureVisual feature={f} exiting={exiting} />
          </div>
        </div>

        {/* ── Bottom feature tab strip ── */}
        <div style={{
          display: 'flex', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', overflow: 'hidden',
        }}>
          {FEATURES.map((feat, i) => (
            <button key={i} className="feat-tab-btn" onClick={() => goTo(i)} style={{
              flex: 1, padding: '14px 4px', border: 'none',
              borderTop: i === idx ? `2.5px solid ${feat.color}` : '2.5px solid transparent',
              background: i === idx ? `${feat.color}0C` : 'transparent',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
              opacity: i === idx ? 1 : 0.38,
              transition: 'all 0.3s ease',
            }}>
              <span style={{ fontSize: '1.1rem' }}>{feat.icon}</span>
              <span style={{
                fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif",
                color: i === idx ? feat.color : 'var(--text-faint)',
                transition: 'color 0.3s ease',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Auth Modal ─────────────────────────────────────────────────── */
function AuthModal({ open, onClose, defaultMode = 'login' }) {
  const { t } = useLang()
  const { login, register } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()

  const [mode, setMode]       = useState(defaultMode)
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShow]   = useState(false)
  const [verifySent, setVerifySent]     = useState(false)
  const [autoVerified, setAutoVerified] = useState(false)

  useEffect(() => { if (open) setMode(defaultMode) }, [defaultMode, open])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  // Poll for verification while the "check inbox" screen is up — the moment the
  // user clicks the link in their mail, sign them in here and go to the dashboard.
  useEffect(() => {
    if (!verifySent || autoVerified) return
    let active = true
    const id = setInterval(async () => {
      try {
        const { verified } = await api.checkVerification(email)
        if (verified && active) {
          clearInterval(id)
          setAutoVerified(true)
          try { await login(email, password); navigate('/dashboard') }
          catch { toast('Email verified! Please sign in.', 'success'); setVerifySent(false); setMode('login') }
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => { active = false; clearInterval(id) }
  }, [verifySent, autoVerified, email, password])

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (mode === 'login') { await login(email, password); toast(t('landing_auth_welcome'), 'success'); navigate('/dashboard') }
      else {
        const data = await register(email, password, name)
        if (data?.needsVerification) { setVerifySent(true) }
        else { toast(t('landing_auth_created'), 'success'); navigate('/dashboard') }
      }
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  const handleSocial = p => { const b = import.meta.env.VITE_API_URL || ''; window.location.href = `${b}/api/auth/${p}` }

  if (!open) return null
  return (
    <div id="auth-modal-backdrop" onClick={e => e.target.id === 'auth-modal-backdrop' && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', animation: 'mFadeIn 0.2s ease' }}>
      <div style={{ width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 32px 80px rgba(0,0,0,0.2)', border: '1px solid var(--border)', animation: 'mSlideUp 0.26s cubic-bezier(0.22,1,0.36,1)', position: 'relative' }}>
        <button id="auth-modal-close" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}>
          <XIcon />
        </button>

        {verifySent && (
          <div style={{ textAlign: 'center', padding: '12px 4px' }}>
            <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>{autoVerified ? '🎉' : '📬'}</div>
            <h2 style={{ margin: '0 0 8px', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '1.5rem', color: 'var(--text)' }}>
              {autoVerified ? 'Email verified!' : 'Check your inbox'}
            </h2>
            {autoVerified ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Signing you in…</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 22 }}>
                  We've sent a verification link to <strong style={{ color: 'var(--text)' }}>{email}</strong>. Open it and you'll be signed in here automatically.
                </p>
                {inboxUrlFor(email) && (
                  <a href={inboxUrlFor(email)} target="_blank" rel="noopener noreferrer"
                     style={{ display: 'block', height: 46, lineHeight: '46px', borderRadius: 8, background: 'linear-gradient(135deg, #00D4FF, #FF2D8B)', color: '#fff', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', marginBottom: 14 }}>
                    Open your email →
                  </a>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-faint)', fontSize: '0.8rem', marginBottom: 16 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 1.2s ease infinite' }} />
                  Waiting for you to verify…
                </div>
                <p style={{ color: 'var(--text-faint)', fontSize: '0.76rem', margin: 0 }}>Didn't get it? Check your spam folder.</p>
              </>
            )}
          </div>
        )}

        {!verifySent && (<>
        <h2 style={{ margin: '0 0 6px', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: '1.55rem', color: 'var(--text)', letterSpacing: '-0.025em' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '0.84rem', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
          {mode === 'login' ? 'Sign in to continue creating.' : 'Start building your creator presence today.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {[
            { id: 'google',    label: t('landing_auth_google'),    icon: <GoogleIcon />,    bg: '#fff', color: '#111', border: '1.5px solid #e0e0e0', soon: false },
            { id: 'instagram', label: t('landing_auth_instagram'), icon: <InstagramIcon />, bg: 'linear-gradient(45deg,#405DE6,#C13584,#E1306C)', color: '#fff', soon: true },
            { id: 'youtube',   label: t('landing_auth_youtube'),   icon: <YouTubeIcon />,   bg: '#FF0000', color: '#fff', soon: true },
          ].map(btn => (
            <button key={btn.id} id={`auth-btn-${btn.id}`} type="button" disabled={btn.soon} onClick={() => !btn.soon && handleSocial(btn.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, padding: '0 16px', borderRadius: 8, cursor: btn.soon ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '0.88rem', fontWeight: 500, background: btn.bg, color: btn.color, border: btn.border || 'none', opacity: btn.soon ? 0.38 : 1 }}>
              <span style={{ display: 'flex', width: 20, flexShrink: 0 }}>{btn.icon}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>{btn.label}</span>
              {btn.soon && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Soon</span>}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {mode === 'register' && (
            <div className="field">
              <label style={{ fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif" }}>{t('landing_auth_name_label')}</label>
              <input className="input" placeholder={t('landing_auth_name_ph')} value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label style={{ fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif" }}>{t('landing_auth_email_label')}</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ margin: 0, fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif" }}>{t('landing_auth_pass_label')}</label>
              {mode === 'login' && <Link to="/forgot-password" onClick={onClose} style={{ fontSize: '0.76rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>{t('landing_auth_forgot')}</Link>}
            </div>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder={mode === 'register' ? t('landing_auth_pass_ph_new') : '••••••••'} value={password} onChange={e => setPass(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, display: 'flex' }}>
                {showPass
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
            {mode === 'register' && <PasswordChecklist password={password} />}
          </div>
          <button id="auth-submit-btn" type="submit" disabled={loading || (mode === 'register' && !isPasswordValid(password))}
            style={{ marginTop: 4, height: 46, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #00D4FF, #FF2D8B)', color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 24px rgba(0,212,255,0.25)' }}>
            {loading ? <><span className="spinner" /> {t('landing_auth_processing')}</> : mode === 'login' ? t('landing_auth_signin_btn') : t('landing_auth_signup_btn')}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 16, marginBottom: 0, fontFamily: "'DM Sans', sans-serif" }}>
          {mode === 'login' ? t('landing_auth_no_account') : t('landing_auth_has_account')}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", padding: '0 0 0 4px' }}>
            {mode === 'login' ? t('landing_auth_signup_link') : t('landing_auth_signin_link')}
          </button>
        </p>
        </>)}
      </div>
    </div>
  )
}

/* ─── Landing Page ───────────────────────────────────────────────── */
export default function Landing() {
  const { t } = useLang()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('login')
  const openModal = (mode = 'login') => { setModalMode(mode); setModalOpen(true) }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>
      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} defaultMode={modalMode} />

      {/* ── Navbar ─────────────────────────────────────────────────
          Sits ABOVE the video frame (in the page margin area)
      ─────────────────────────────────────────────────────────── */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 10, flexWrap: 'wrap' }}>
        {/* Logo ,  always in original vibrant colour */}
        <Logo size={30} showWordmark />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <LangFlip />
          <ThemeToggle size="sm" />
          <button id="nav-signin-btn" onClick={() => openModal('login')}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.84rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', var(--font-body)", transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Sign In
          </button>
          <button id="nav-getstarted-btn" onClick={() => openModal('register')}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00D4FF,#FF2D8B)', color: '#fff', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', var(--font-body)", boxShadow: '0 4px 16px rgba(0,212,255,0.25)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero Video ,  framed with margin ────────────────────────
          The 20px padding on all sides creates the "border/frame" 
          effect the user requested.
      ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ position: 'relative', height: 'calc(100vh - 90px)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <HeroVideo />

          {/* Hero text sits on top of the video */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 6%' }}>
            <p className="lp-up" style={{ animationDelay: '0.1s', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 18 }}>
              AI-Powered Content Creation
            </p>
            <h1 className="lp-up" style={{ animationDelay: '0.2s', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(2.6rem,6.5vw,5.5rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 24px', maxWidth: 800, whiteSpace: 'pre-line' }}>
              {t('landing_hero_h1')}
            </h1>
            <p className="lp-up" style={{ animationDelay: '0.3s', fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(0.95rem,1.6vw,1.1rem)', color: 'rgba(255,255,255,0.62)', lineHeight: 1.7, margin: '0 auto 40px', maxWidth: 460 }}>
              {t('landing_hero_sub')}
            </p>
            <div className="lp-up" style={{ animationDelay: '0.4s', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button id="hero-start-btn" onClick={() => openModal('register')}
                style={{ padding: '13px 32px', borderRadius: 8, border: 'none', background: '#fff', color: '#111', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(0)' }}>
                {t('landing_hero_btn')}
              </button>
              <button id="hero-signin-link" onClick={() => openModal('login')}
                style={{ padding: '13px 24px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)' }}>
                {t('landing_hero_signin')}
              </button>
            </div>
          </div>

          {/* Scroll hint */}
          <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'scrollBounce 2s ease-in-out infinite' }}>
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>Scroll</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>

      {/* ── Feature Carousel ─────────────────────────────────────── */}
      <section style={{ padding: '90px 20px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', whiteSpace: 'nowrap' }}>{t('landing_feat_eyebrow')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <FeatureCarousel />
        </div>
      </section>

      {/* ── About Section ────────────────────────────────────────── */}
      <section style={{ padding: '90px 20px', background: 'var(--surface2)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 16 }}>{t('landing_about_eyebrow')}</p>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', color: 'var(--text)', letterSpacing: '-0.025em', lineHeight: 1.2, margin: '0 0 22px' }}>
              {t('landing_about_h2')}
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1.8, margin: '0 0 14px' }}>
              {t('landing_about_p1')}
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
              {t('landing_about_p2')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🇮🇳', label: t('landing_about_b1_title'), sub: t('landing_about_b1_sub') },
              { icon: '📱', label: t('landing_about_b2_title'), sub: t('landing_about_b2_sub') },
              { icon: '🔒', label: t('landing_about_b3_title'), sub: t('landing_about_b3_sub') },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.76rem', color: 'var(--text-faint)', marginTop: 2 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section style={{ padding: '110px 20px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--accent)', marginBottom: 24 }}>Script anytime, anywhere!</p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 16 }}>{t('landing_ready_eyebrow')}</p>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(2rem,5.5vw,3.6rem)', color: 'var(--text)', letterSpacing: '-0.025em', margin: '0 auto 32px', maxWidth: 600, lineHeight: 1.15 }}>
          {t('landing_ready_h2')}
        </h2>
        <button id="bottom-cta-btn" onClick={() => openModal('register')}
          style={{ padding: '14px 38px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00D4FF,#FF2D8B)', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 8px 28px rgba(0,212,255,0.3)', transition: 'all 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(0,212,255,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,212,255,0.3)' }}>
          {t('landing_ready_btn')}
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '22px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: "'DM Sans', sans-serif" }}>
          {t('landing_footer_legal')}
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([label, to]) => (
            <Link key={to} to={to} style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
              {label}
            </Link>
          ))}
        </div>
      </footer>

      {/* ── Global Styles ────────────────────────────────────────── */}
      <style>{`
        .lp-up {
          opacity: 0;
          animation: lpUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes lpUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollBounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(7px); }
        }
        @keyframes mFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mSlideUp {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Mobile ,  stack About grid */
        @media (max-width: 720px) {
          section > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }

        /* Mobile ,  stack feature carousel */
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"]:has(h3) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}