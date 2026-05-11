import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useLang } from '../i18n.jsx'
import { useAuth } from '../store'
import { useToast } from '../components/Toast'
import ThemeToggle from '../components/ThemeToggle'

/* ─── Language flip ──────────────────────────────────────────────── */
function LangFlip() {
  const { lang, setLanguage } = useLang()
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 99, padding: 3,
    }}>
      {[{ code: 'en', label: 'EN' }, { code: 'hi', label: 'हिं' }].map(o => {
        const active = lang === o.code
        return (
          <button key={o.code} type="button"
            onClick={() => !active && setLanguage(o.code)} aria-pressed={active}
            style={{
              border: 'none', cursor: active ? 'default' : 'pointer',
              padding: '4px 11px', borderRadius: 99,
              background: active ? 'linear-gradient(135deg,#00D4FF,#FF2D8B)' : 'transparent',
              color: active ? '#fff' : 'var(--text-muted)',
              fontFamily: o.code === 'hi' ? 'var(--font-body)' : 'var(--font-mono)',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
              transition: 'background 0.18s,color 0.18s',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ─── SVG Icons ──────────────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════
   APP PHONE  (unchanged)
══════════════════════════════════════════════════════════════════ */
const DEMO = {
  en: {
    s1Title: 'Script Studio',
    topic: 'Morning fitness routine',
    hook: 'Most beginners quit the gym in week 2.',
    body: "Here's the one habit that kept me consistent for 2 years straight.",
    cta: 'Follow for part 2 🔥',
    topicLbl: 'Topic', hookLbl: 'Hook', bodyLbl: 'Body', ctaLbl: 'CTA',
    s2Title: 'Hook Score',
    viralPotential: 'Viral Potential',
    bars: [
      { l: 'Curiosity', v: 96, c: '#00D4FF' },
      { l: 'Emotion',   v: 88, c: '#FF2D8B' },
      { l: 'Clarity',   v: 97, c: '#A8FF3C' },
      { l: 'CTA Power', v: 92, c: '#FFB800' },
    ],
    s3Title: 'Crosspost',
    cpDesc: 'Script adapted & posted everywhere ✓',
    cpNote: 'One click. Every platform.',
    s4Title: 'Trending Now',
    trends: [
      { tag: '#MorningRoutine', views: '2.4M views', delta: '+38%', i: 1, c: '#FF2D8B', delay: '0.3s' },
      { tag: '#FitnessIndia',   views: '1.8M views', delta: '+21%', i: 2, c: '#00D4FF', delay: '0.7s' },
      { tag: '#AILifestyle',    views: '987K views',  delta: '+57%', i: 3, c: '#A8FF3C', delay: '1.1s' },
      { tag: '#5AMClub',        views: '741K views',  delta: '+14%', i: 4, c: '#FFB800', delay: '1.5s' },
    ],
    s5Title: 'Creator Advisor',
    q1: 'How do I grow faster on Reels?',
    a1: 'Post between 7–9 AM daily. Use trending audio. Your hooks need more pattern interrupts — start with a bold claim or question. 💡',
    q2: 'Which hashtags?',
    labels: ['Script Studio', 'Hook Score', 'Crosspost', 'Trending', 'Creator Advisor'],
  },
  hi: {
    s1Title: 'स्क्रिप्ट स्टूडियो',
    topic: 'सुबह की फिटनेस रूटीन',
    hook: 'ज़्यादातर नए लोग gym दूसरे हफ्ते छोड़ देते हैं।',
    body: 'यही एक आदत है जिसने मुझे 2 साल तक consistent रखा।',
    cta: 'Part 2 के लिए follow करो 🔥',
    topicLbl: 'विषय', hookLbl: 'हुक', bodyLbl: 'बॉडी', ctaLbl: 'CTA',
    s2Title: 'हुक स्कोर',
    viralPotential: 'वायरल संभावना',
    bars: [
      { l: 'जिज्ञासा',   v: 96, c: '#00D4FF' },
      { l: 'भावना',      v: 88, c: '#FF2D8B' },
      { l: 'स्पष्टता',  v: 97, c: '#A8FF3C' },
      { l: 'CTA पावर',  v: 92, c: '#FFB800' },
    ],
    s3Title: 'क्रॉसपोस्ट',
    cpDesc: 'स्क्रिप्ट हर जगह post हो गई ✓',
    cpNote: 'एक क्लिक। हर प्लेटफॉर्म।',
    s4Title: 'ट्रेंडिंग अभी',
    trends: [
      { tag: '#MorningRoutine', views: '2.4M व्यूज़', delta: '+38%', i: 1, c: '#FF2D8B', delay: '0.3s' },
      { tag: '#FitnessIndia',   views: '1.8M व्यूज़', delta: '+21%', i: 2, c: '#00D4FF', delay: '0.7s' },
      { tag: '#AILifestyle',    views: '987K व्यूज़',  delta: '+57%', i: 3, c: '#A8FF3C', delay: '1.1s' },
      { tag: '#5AMClub',        views: '741K व्यूज़',  delta: '+14%', i: 4, c: '#FFB800', delay: '1.5s' },
    ],
    s5Title: 'क्रिएटर एडवाइज़र',
    q1: 'Reels पर जल्दी grow कैसे करूं?',
    a1: 'रोज़ सुबह 7–9 बजे post करो। Trending audio use करो। Hooks में bold claim या question से शुरू करो। 💡',
    q2: 'कौन से hashtags?',
    labels: ['स्क्रिप्ट स्टूडियो', 'हुक स्कोर', 'क्रॉसपोस्ट', 'ट्रेंडिंग', 'क्रिएटर एडवाइज़र'],
  },
}

function AppPhone() {
  const { lang } = useLang()
  const d = DEMO[lang] || DEMO.en
  return (
    <div className="ap-outer">
      <div className="ap-glow ap-glow-c" aria-hidden />
      <div className="ap-glow ap-glow-p" aria-hidden />
      <div className="ap-phone">
        <div className="ap-island" />
        <div className="ap-screen">
          <div className="ap-scene ap-s1">
            <div className="ap-hdr" style={{ '--hc': '#00D4FF' }}>
              <span className="ap-hdr-icon">✍</span>
              <span className="ap-hdr-title">{d.s1Title}</span>
              <span className="ap-live-pill"><span className="ap-live-dot" />LIVE</span>
            </div>
            <div className="ap-field-lbl">{d.topicLbl}</div>
            <div className="ap-input-row">
              <span className="ap-typed-text">{d.topic}</span>
              <span className="ap-cursor" />
            </div>
            <div className="ap-field-lbl" style={{ marginTop: 10 }}>{d.hookLbl}</div>
            <div className="ap-script-line ap-sl-hook" style={{ animationDelay: '1.2s' }}>
              <span className="ap-tag" style={{ '--tc': '#00D4FF' }}>hook</span>{d.hook}
            </div>
            <div className="ap-field-lbl" style={{ marginTop: 8 }}>{d.bodyLbl}</div>
            <div className="ap-script-line" style={{ animationDelay: '1.8s' }}>
              <span className="ap-tag" style={{ '--tc': '#A855F7' }}>body</span>{d.body}
            </div>
            <div className="ap-field-lbl" style={{ marginTop: 8 }}>{d.ctaLbl}</div>
            <div className="ap-script-line ap-sl-cta" style={{ animationDelay: '2.4s' }}>
              <span className="ap-tag" style={{ '--tc': '#FF2D8B' }}>cta</span>{d.cta}
            </div>
          </div>
          <div className="ap-scene ap-s2">
            <div className="ap-hdr" style={{ '--hc': '#A8FF3C' }}>
              <span className="ap-hdr-icon">🎯</span>
              <span className="ap-hdr-title">{d.s2Title}</span>
              <span className="ap-badge" style={{ '--bc': '#A8FF3C' }}>AI Rating</span>
            </div>
            <div className="ap-score-center">
              <svg className="ap-gauge-svg" viewBox="0 0 120 66">
                <defs>
                  <linearGradient id="gaugeG" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#A8FF3C" />
                    <stop offset="50%"  stopColor="#00D4FF" />
                    <stop offset="100%" stopColor="#FF2D8B" />
                  </linearGradient>
                </defs>
                <path className="ap-gauge-bg" d="M 10 60 A 50 50 0 0 1 110 60" stroke="rgba(255,255,255,0.07)" strokeWidth="7" fill="none" strokeLinecap="round"/>
                <path className="ap-gauge-fill" d="M 10 60 A 50 50 0 0 1 110 60" stroke="url(#gaugeG)" strokeWidth="7" fill="none" strokeLinecap="round"/>
              </svg>
              <div className="ap-score-num">94</div>
              <div className="ap-score-sub">{d.viralPotential}</div>
            </div>
            <div className="ap-bars">
              {d.bars.map((b, i) => (
                <div key={i} className="ap-bar-row" style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
                  <span className="ap-bar-lbl">{b.l}</span>
                  <div className="ap-bar-track"><div className="ap-bar-fill" style={{ '--bw': b.v + '%', '--bc': b.c, animationDelay: `${0.6 + i * 0.15}s` }} /></div>
                  <span className="ap-bar-val" style={{ color: b.c }}>{b.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ap-scene ap-s3">
            <div className="ap-hdr" style={{ '--hc': '#FF2D8B' }}>
              <span className="ap-hdr-icon">⇄</span>
              <span className="ap-hdr-title">{d.s3Title}</span>
              <span className="ap-badge" style={{ '--bc': '#FF2D8B' }}>4 platforms</span>
            </div>
            <div className="ap-cp-desc">{d.cpDesc}</div>
            <div className="ap-cp-platforms">
              {[
                { icon: '𝕏',  label: 'Twitter / X',   color: '#1DA1F2', delay: '0.4s' },
                { icon: 'in', label: 'LinkedIn',        color: '#0077B5', delay: '0.9s' },
                { icon: '▶',  label: 'YouTube Shorts',  color: '#FF5F4C', delay: '1.4s' },
                { icon: '◈',  label: 'Instagram',       color: '#E1306C', delay: '1.9s' },
              ].map(p => (
                <div key={p.icon} className="ap-cp-row" style={{ animationDelay: p.delay }}>
                  <span className="ap-cp-icon" style={{ color: p.color }}>{p.icon}</span>
                  <span className="ap-cp-label">{p.label}</span>
                  <span className="ap-cp-check">✓</span>
                </div>
              ))}
            </div>
            <div className="ap-cp-note">{d.cpNote}</div>
          </div>
          <div className="ap-scene ap-s4">
            <div className="ap-hdr" style={{ '--hc': '#FFB800' }}>
              <span className="ap-hdr-icon">📈</span>
              <span className="ap-hdr-title">{d.s4Title}</span>
              <span className="ap-live-pill ap-live-amber"><span className="ap-live-dot ap-live-dot-a" />LIVE</span>
            </div>
            <div className="ap-trends">
              {d.trends.map(t => (
                <div key={t.tag} className="ap-trend-row" style={{ animationDelay: t.delay }}>
                  <span className="ap-trend-rank" style={{ color: t.c }}>{t.i}</span>
                  <div className="ap-trend-info">
                    <div className="ap-trend-tag">{t.tag}</div>
                    <div className="ap-trend-views">{t.views}</div>
                  </div>
                  <span className="ap-trend-delta" style={{ color: t.c }}>{t.delta} ↑</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ap-scene ap-s5">
            <div className="ap-hdr" style={{ '--hc': '#A855F7' }}>
              <span className="ap-hdr-icon">🤖</span>
              <span className="ap-hdr-title">{d.s5Title}</span>
              <span className="ap-badge" style={{ '--bc': '#A855F7' }}>24/7</span>
            </div>
            <div className="ap-chat">
              <div className="ap-msg ap-msg-u" style={{ animationDelay: '0.2s' }}>{d.q1}</div>
              <div className="ap-msg ap-msg-ai" style={{ animationDelay: '0.9s' }}>{d.a1}</div>
              <div className="ap-msg ap-msg-u" style={{ animationDelay: '2.0s' }}>{d.q2}</div>
              <div className="ap-typing" style={{ animationDelay: '2.6s' }}><span /><span /><span /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="ap-dots">
        {[1,2,3,4,5].map(n => <div key={n} className={`ap-dot ap-dot-${n}`} title={d.labels[n-1]} />)}
      </div>
      <div className="ap-label-wrap">
        {[{ n:1,c:'#00D4FF'},{n:2,c:'#A8FF3C'},{n:3,c:'#FF2D8B'},{n:4,c:'#FFB800'},{n:5,c:'#A855F7'}].map((f,i) => (
          <div key={f.n} className={`ap-label ap-label-${f.n}`} style={{ '--lc': f.c }}>{d.labels[i]}</div>
        ))}
      </div>
      <div className="vb vb-thumb"   aria-hidden>👍</div>
      <div className="vb vb-eyes"    aria-hidden>👀</div>
      <div className="vb vb-comment" aria-hidden>💬</div>
      <div className="vb vb-heart"   aria-hidden>❤️</div>
      <div className="vb vb-fire"    aria-hidden>🔥</div>
      <div className="vb vb-rise vb-rise-1" aria-hidden>❤️</div>
      <div className="vb vb-rise vb-rise-2" aria-hidden>🧡</div>
      <div className="vb vb-rise vb-rise-3" aria-hidden>❤️</div>
      <div className="vb vb-rise vb-rise-4" aria-hidden>😍</div>
      <div className="vb vb-spark vb-spark-1" aria-hidden>✦</div>
      <div className="vb vb-spark vb-spark-2" aria-hidden>✦</div>
      <div className="vb vb-spark vb-spark-3" aria-hidden>✸</div>
    </div>
  )
}

/* ─── Landing Page ───────────────────────────────────────────────── */
export default function Landing() {
  const { t } = useLang()
  const { login, register } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()

  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPass]     = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        toast(t('landing_auth_welcome'), 'success')
      } else {
        await register(email, password, name)
        toast(t('landing_auth_created'), 'success')
      }
      navigate('/dashboard')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialClick = platform => {
    const base = import.meta.env.VITE_API_URL || ''
    window.location.href = `${base}/api/auth/${platform}`
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <Logo size={36} showWordmark />
        <div className="lp-nav-actions">
          <LangFlip />
          <ThemeToggle size="sm" />
        </div>
      </nav>

      {/* ── Hero: Phone left · Auth right ────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-bg" aria-hidden>
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
        </div>

        {/* ── Tagline ──────────────────────────────────────────── */}
        <div className="lp-heading">
          <div className="lp-words-row1">
            <span>{t('landing_h1_a')}</span>
            <span className="lp-grad">{t('landing_h1_b')}</span>
          </div>
          <p className="lp-sub">{t('landing_sub')}</p>
        </div>

        {/* Bottom row */}
        <div className="lp-bottom-row">

        {/* Left — phone mockup */}
        <div className="lp-visual">
          <AppPhone />
        </div>

        {/* Right — auth card */}
        <div className="lp-auth-col">

          {/* Auth card */}
          <div className="lp-auth-card">

            {/* Social buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
              {[
                { id: 'google',    label: t('landing_auth_google'),    icon: <GoogleIcon />,    bg: '#fff',                                                        color: '#1f1f1f', border: '1px solid rgba(0,0,0,0.15)', soon: false },
                { id: 'instagram', label: t('landing_auth_instagram'), icon: <InstagramIcon />, bg: 'linear-gradient(45deg,#405DE6,#833AB4,#C13584,#E1306C)',     color: '#fff',    border: 'none',                       soon: true  },
                { id: 'youtube',   label: t('landing_auth_youtube'),   icon: <YouTubeIcon />,   bg: '#FF0000',                                                     color: '#fff',    border: 'none',                       soon: true  },
              ].map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  disabled={btn.soon}
                  onClick={() => !btn.soon && handleSocialClick(btn.id)}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', height: 44, padding: '0 16px',
                    borderRadius: 10, cursor: btn.soon ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                    fontWeight: 600, transition: 'opacity 0.15s, transform 0.15s',
                    background: btn.bg, color: btn.color, border: btn.border || 'none',
                    opacity: btn.soon ? 0.38 : 1,
                    filter: btn.soon ? 'grayscale(0.4)' : 'none',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, flexShrink: 0 }}>{btn.icon}</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>{btn.label}</span>
                  {btn.soon && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 99, background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', flexShrink: 0 }}>
                      {t('landing_auth_soon')}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* OR divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('landing_auth_or')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Email form */}
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mode === 'register' && (
                <div className="field">
                  <label>{t('landing_auth_name_label')}</label>
                  <input className="input" placeholder={t('landing_auth_name_ph')} value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                </div>
              )}
              <div className="field">
                <label>{t('landing_auth_email_label')}</label>
                <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>{t('landing_auth_pass_label')}</label>
                  {mode === 'login' && (
                    <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                      {t('landing_auth_forgot')}
                    </Link>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    placeholder={mode === 'register' ? t('landing_auth_pass_ph_new') : '••••••••'}
                    value={password}
                    onChange={e => setPass(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, display: 'flex', alignItems: 'center' }}
                    tabIndex={-1}
                    aria-label={showPass ? t('landing_auth_pass_hide') : t('landing_auth_pass_show')}
                  >
                    {showPass ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
                style={{ marginTop: 2, fontSize: '1rem', fontWeight: 700 }}
              >
                {loading
                  ? <><span className="spinner" /> {t('landing_auth_processing')}</>
                  : mode === 'login' ? t('landing_auth_signin_btn') : t('landing_auth_signup_btn')}
              </button>
            </form>

            {/* Toggle */}
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 16, marginBottom: 0 }}>
              {mode === 'login' ? t('landing_auth_no_account') : t('landing_auth_has_account')}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-body)', padding: 0 }}
              >
                {mode === 'login' ? t('landing_auth_signup_link') : t('landing_auth_signin_link')}
              </button>
            </p>
          </div>

          {/* Fine print below card — width matches card so text sits centered under it */}
          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 14, width: 360 }}>
            {t('landing_cta_fine')}
          </p>
        </div>
        </div>{/* /lp-bottom-row */}
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '20px 5%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        background: 'var(--surface)', marginTop: 'auto',
      }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
          {t('landing_footer_legal')}
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <Link to="/privacy" style={{ fontSize: '0.74rem', color: 'var(--text-faint)', textDecoration: 'none' }}>{t('landing_privacy')}</Link>
          <Link to="/terms"   style={{ fontSize: '0.74rem', color: 'var(--text-faint)', textDecoration: 'none' }}>{t('landing_terms')}</Link>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════
          STYLES
      ══════════════════════════════════════════════════════════ */}
      <style>{`

        /* ── Navbar ──────────────────────────────────────────────── */
        .lp-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 5%;
          background: var(--surface-nav);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid var(--border-nav);
          position: sticky; top: 0; z-index: 100;
          gap: 10px;
        }
        .lp-nav-actions {
          display: flex; align-items: center; gap: 8px;
          flex-shrink: 0;
        }
        @media (max-width: 480px) {
          .lp-nav { padding: 10px 4%; }
          .lp-nav-tagline { font-size: 0.72rem; }
        }

        /* ── Hero layout ─────────────────────────────────────────── */
        .lp-hero {
          position: relative; flex: 1;
          display: flex; flex-direction: column;
          padding: 28px 6% 48px;
          max-width: 1280px; margin: 0 auto; width: 100%;
          min-height: calc(100vh - 130px);
          box-sizing: border-box;
          gap: 32px;
        }
        .lp-bg { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:0; }
        .lp-orb { position:absolute; border-radius:50%; filter:blur(80px); }
        .lp-orb-1 { top:-10%; left:-6%; width:480px; height:380px;
          background:radial-gradient(ellipse,rgba(0,212,255,0.09) 0%,transparent 65%); }
        .lp-orb-2 { bottom:-5%; right:-4%; width:460px; height:400px;
          background:radial-gradient(ellipse,rgba(255,45,139,0.10) 0%,transparent 65%); }

        .lp-visual {
          position:relative; z-index:1;
          display:flex; justify-content:flex-start; align-items:center;
          animation: fadeUp 0.6s 0.05s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* ── Top heading ─────────────────────────────────────────── */
        .lp-heading {
          position:relative; z-index:1;
          display:flex; flex-direction:column; align-items:center;
          text-align:center;
          animation: fadeUp 0.4s 0.05s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lp-words-row1 {
          display:flex; justify-content:center; gap:12px;
          font-family:var(--font-head); font-weight:800;
          font-size:clamp(1.4rem,2vw,2.2rem);
          letter-spacing:-0.02em; line-height:1.2;
          color:var(--text);
        }
        .lp-words-row2 {
          text-align:center;
          font-family:var(--font-head); font-weight:800;
          font-size:clamp(1.4rem,2vw,2.2rem);
          letter-spacing:-0.02em; line-height:1.2;
          margin-top:2px; margin-bottom:10px;
        }

        /* ── Bottom row: phone + login ───────────────────────────── */
        .lp-bottom-row {
          position:relative; z-index:1;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
          flex: 1;
        }
        .lp-grad {
          background:linear-gradient(135deg,#00D4FF 0%,#FF2D8B 55%,#FFB800 100%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text; display:inline-block;
          filter:drop-shadow(0 0 32px rgba(255,45,139,0.26));
        }
        .lp-sub {
          font-size:clamp(0.78rem,1vw,0.88rem); color:var(--text-muted);
          line-height:1.65; margin:0; text-align:center;
        }

        /* ── Auth column ─────────────────────────────────────────── */
        .lp-auth-col {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: flex-end;
          animation: fadeUp 0.5s 0.14s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* ── Auth card ───────────────────────────────────────────── */
        .lp-auth-card {
          background: var(--surface-card);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border-bright);
          border-radius: 20px;
          padding: 28px;
          box-shadow: var(--shadow-glass);
          width: 360px;
        }
        .lp-tagline { width: 360px; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* ── Mobile layout ─────────────────────────────────────────── */
        @media (max-width: 860px) {
          .lp-hero { padding: 24px 5% 40px; gap: 24px; min-height: auto; }
          .lp-bottom-row { grid-template-columns: 1fr; gap: 28px; }
          .lp-visual   { justify-content: center; }
          .lp-auth-col { align-items: center; }
          .lp-auth-card { width: 100%; max-width: 420px; }
          .lp-sub { max-width: 340px; margin: 0 auto; }
        }

        /* ══════════════════════════════════════════════════════════
           PHONE
        ══════════════════════════════════════════════════════════ */
        .ap-outer {
          position:relative;
          display:flex; flex-direction:column; align-items:center;
          gap: 18px;
        }
        .ap-glow { position:absolute; border-radius:50%; filter:blur(70px); pointer-events:none; z-index:0; }
        .ap-glow-c { width:300px; height:300px; top:5%; left:-15%; background:radial-gradient(ellipse,rgba(0,212,255,0.13) 0%,transparent 70%); }
        .ap-glow-p { width:280px; height:280px; bottom:5%; right:-10%; background:radial-gradient(ellipse,rgba(255,45,139,0.12) 0%,transparent 70%); }

        .ap-phone {
          position:relative; z-index:2;
          width:248px; height:504px;
          background:#050710;
          border-radius:42px;
          box-shadow: 0 60px 100px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.08), 0 0 60px rgba(0,212,255,0.10), 0 0 40px rgba(255,45,139,0.08), inset 0 0 0 1px rgba(255,255,255,0.04);
          padding: 12px;
        }
        .ap-island { position:absolute; top:12px; left:50%; transform:translateX(-50%); width:84px; height:20px; background:#000; border-radius:14px; z-index:10; box-shadow:0 0 0 1px rgba(255,255,255,0.05); }
        .ap-screen { width:100%; height:100%; background:linear-gradient(160deg,#07091E 0%,#0B0E2C 100%); border-radius:32px; overflow:hidden; position:relative; }
        .ap-screen::after { content:''; position:absolute; inset:0; pointer-events:none; background: radial-gradient(ellipse at 20% 10%,rgba(0,212,255,0.06) 0%,transparent 50%), radial-gradient(ellipse at 80% 90%,rgba(255,45,139,0.06) 0%,transparent 50%); border-radius:inherit; }

        .ap-scene { position:absolute; inset:0; padding:46px 16px 18px; opacity:0; display:flex; flex-direction:column; animation:sceneCycle 25s ease-in-out infinite; overflow:hidden; }
        .ap-s1 { animation-delay: 0s; }
        .ap-s2 { animation-delay: 5s; }
        .ap-s3 { animation-delay:10s; }
        .ap-s4 { animation-delay:15s; }
        .ap-s5 { animation-delay:20s; }
        @keyframes sceneCycle {
          0%,1%    { opacity:0; transform:translateY(14px); }
          5%       { opacity:1; transform:translateY(0); }
          17%      { opacity:1; transform:translateY(0); }
          20%,100% { opacity:0; transform:translateY(-12px); }
        }

        .ap-hdr { display:flex; align-items:center; gap:7px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:12px; }
        .ap-hdr-icon { font-size:0.9rem; }
        .ap-hdr-title { flex:1; font-family:var(--font-head); font-weight:800; font-size:0.78rem; color:#fff; letter-spacing:-0.015em; }
        .ap-live-pill { display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:99px; background:rgba(0,212,255,0.12); border:1px solid rgba(0,212,255,0.25); color:#00D4FF; font-family:var(--font-mono); font-size:0.5rem; font-weight:800; letter-spacing:0.1em; }
        .ap-live-amber { background:rgba(255,184,0,0.12); border-color:rgba(255,184,0,0.25); color:#FFB800; }
        .ap-live-dot { width:4px; height:4px; border-radius:50%; background:#00D4FF; box-shadow:0 0 6px #00D4FF; animation:livePulse 1.2s ease-in-out infinite; }
        .ap-live-dot-a { background:#FFB800; box-shadow:0 0 6px #FFB800; }
        @keyframes livePulse { 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:0.3; transform:scale(0.6); } }
        .ap-badge { font-size:0.48rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; padding:2px 6px; border-radius:4px; color:var(--bc); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); }
        .ap-field-lbl { font-family:var(--font-mono); font-size:0.5rem; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:4px; }

        .ap-input-row { display:flex; align-items:center; background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.22); border-radius:8px; padding:6px 9px; margin-bottom:2px; }
        .ap-typed-text { font-family:var(--font-mono); font-size:0.62rem; color:#00D4FF; overflow:hidden; white-space:nowrap; width:0; animation:typeText 1.2s steps(24,end) 0.3s forwards; }
        @keyframes typeText { to { width:100%; } }
        .ap-cursor { width:1.5px; height:11px; background:#00D4FF; margin-left:2px; flex-shrink:0; animation:blink 0.7s steps(1) infinite; }
        @keyframes blink { 50%{ opacity:0; } }

        .ap-script-line { background:rgba(255,255,255,0.04); border-radius:7px; padding:6px 8px; font-size:0.62rem; line-height:1.4; color:rgba(255,255,255,0.85); display:flex; gap:5px; align-items:flex-start; opacity:0; transform:translateY(6px); animation:lineSlideIn 0.35s ease forwards; border-left:2px solid rgba(255,255,255,0.12); }
        .ap-sl-hook { border-left-color:#00D4FF; }
        .ap-sl-cta  { border-left-color:#FF2D8B; }
        @keyframes lineSlideIn { to { opacity:1; transform:translateY(0); } }
        .ap-tag { font-family:var(--font-mono); font-size:0.48rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; padding:1px 4px; border-radius:3px; flex-shrink:0; margin-top:1px; color:var(--tc); background:rgba(255,255,255,0.07); }

        .ap-score-center { display:flex; flex-direction:column; align-items:center; margin-bottom:12px; }
        .ap-gauge-svg { width:120px; height:66px; }
        .ap-gauge-fill { stroke-dasharray:157; stroke-dashoffset:157; animation:gaugeAnim 1.4s cubic-bezier(0.22,1,0.36,1) 0.4s forwards; filter:drop-shadow(0 0 5px rgba(0,212,255,0.5)); }
        @keyframes gaugeAnim { to { stroke-dashoffset:10; } }
        .ap-score-num { font-family:var(--font-head); font-weight:900; font-size:2.2rem; line-height:1; margin-top:-16px; background:linear-gradient(135deg,#A8FF3C,#00D4FF,#FF2D8B); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; opacity:0; animation:fadeIn 0.4s ease 1.5s forwards; }
        .ap-score-sub { font-size:0.54rem; color:rgba(255,255,255,0.4); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.12em; margin-top:3px; opacity:0; animation:fadeIn 0.4s ease 1.7s forwards; }
        @keyframes fadeIn { to { opacity:1; } }

        .ap-bars { display:flex; flex-direction:column; gap:7px; }
        .ap-bar-row { display:flex; align-items:center; gap:7px; opacity:0; animation:fadeIn 0.3s ease forwards; }
        .ap-bar-lbl { font-size:0.54rem; color:rgba(255,255,255,0.5); width:54px; flex-shrink:0; font-family:var(--font-mono); }
        .ap-bar-track { flex:1; height:4px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden; }
        .ap-bar-fill { height:100%; border-radius:4px; background:var(--bc); width:0; animation:barGrow 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes barGrow { to { width:var(--bw); } }
        .ap-bar-val { font-size:0.55rem; font-weight:800; font-family:var(--font-mono); width:22px; text-align:right; flex-shrink:0; }

        .ap-cp-desc { font-size:0.6rem; color:rgba(255,255,255,0.5); margin-bottom:12px; font-style:italic; }
        .ap-cp-platforms { display:flex; flex-direction:column; gap:7px; }
        .ap-cp-row { display:flex; align-items:center; gap:9px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:9px; padding:7px 10px; opacity:0; transform:translateX(-10px); animation:cpSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes cpSlideIn { to { opacity:1; transform:translateX(0); } }
        .ap-cp-icon { font-weight:800; font-size:0.8rem; width:18px; text-align:center; flex-shrink:0; }
        .ap-cp-label { flex:1; font-size:0.62rem; color:rgba(255,255,255,0.8); font-weight:600; }
        .ap-cp-check { font-size:0.7rem; font-weight:900; color:#A8FF3C; background:rgba(168,255,60,0.12); width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 8px rgba(168,255,60,0.3); flex-shrink:0; }
        .ap-cp-note { margin-top:14px; font-size:0.58rem; color:rgba(255,255,255,0.35); font-family:var(--font-mono); text-align:center; letter-spacing:0.06em; }

        .ap-trends { display:flex; flex-direction:column; gap:7px; }
        .ap-trend-row { display:flex; align-items:center; gap:9px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:9px; padding:7px 10px; opacity:0; transform:translateY(8px); animation:trendIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes trendIn { to { opacity:1; transform:translateY(0); } }
        .ap-trend-rank { font-family:var(--font-head); font-weight:900; font-size:0.9rem; width:14px; text-align:center; flex-shrink:0; }
        .ap-trend-info { flex:1; }
        .ap-trend-tag { font-size:0.65rem; font-weight:700; color:rgba(255,255,255,0.9); letter-spacing:-0.01em; }
        .ap-trend-views { font-size:0.54rem; color:rgba(255,255,255,0.38); font-family:var(--font-mono); }
        .ap-trend-delta { font-size:0.56rem; font-weight:800; font-family:var(--font-mono); flex-shrink:0; }

        .ap-chat { display:flex; flex-direction:column; gap:8px; }
        .ap-msg { font-size:0.62rem; line-height:1.45; padding:7px 10px; border-radius:12px; max-width:85%; opacity:0; animation:fadeIn 0.3s ease forwards; }
        .ap-msg-u { align-self:flex-end; background:linear-gradient(135deg,#00D4FF,#A855F7); color:#fff; border-radius:12px 12px 3px 12px; }
        .ap-msg-ai { align-self:flex-start; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.88); border:1px solid rgba(255,255,255,0.08); border-radius:3px 12px 12px 12px; }
        .ap-typing { align-self:flex-start; display:flex; gap:4px; padding:8px 12px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.08); border-radius:3px 12px 12px 12px; opacity:0; animation:fadeIn 0.3s ease forwards; }
        .ap-typing span { width:5px; height:5px; border-radius:50%; background:rgba(255,255,255,0.45); animation:typingDot 1s ease-in-out infinite; }
        .ap-typing span:nth-child(2){ animation-delay:0.2s; }
        .ap-typing span:nth-child(3){ animation-delay:0.4s; }
        @keyframes typingDot { 0%,60%,100%{ transform:translateY(0); } 30%{ transform:translateY(-4px); } }

        .ap-dots { display:flex; gap:8px; align-items:center; z-index:2; }
        .ap-dot { height:4px; border-radius:2px; background:rgba(255,255,255,0.2); animation:dotCycle 25s ease-in-out infinite; }
        .ap-dot-1{ background:#00D4FF; animation-delay: 0s; }
        .ap-dot-2{ background:#A8FF3C; animation-delay: 5s; }
        .ap-dot-3{ background:#FF2D8B; animation-delay:10s; }
        .ap-dot-4{ background:#FFB800; animation-delay:15s; }
        .ap-dot-5{ background:#A855F7; animation-delay:20s; }
        @keyframes dotCycle {
          0%,3%    { width:22px; opacity:1; }
          18%,100% { width:5px;  opacity:0.25; }
        }

        .ap-label-wrap { position:relative; height:28px; width:180px; z-index:2; }
        .ap-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:0.68rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--lc); opacity:0; animation:labelCycle 25s ease-in-out infinite; }
        .ap-label-1{ animation-delay: 0s; }
        .ap-label-2{ animation-delay: 5s; }
        .ap-label-3{ animation-delay:10s; }
        .ap-label-4{ animation-delay:15s; }
        .ap-label-5{ animation-delay:20s; }
        @keyframes labelCycle {
          0%,3%    { opacity:0; transform:translateY(4px); }
          6%       { opacity:1; transform:translateY(0); }
          16%      { opacity:1; transform:translateY(0); }
          20%,100% { opacity:0; transform:translateY(-4px); }
        }

        @media (max-width: 480px) {
          .ap-phone { transform:scale(0.82); transform-origin:top center; }
          .ap-outer { gap:10px; }
          .ap-dots    { margin-top:-22px; }
          .ap-label-wrap { margin-top:-18px; height:32px; width:200px; }
          .ap-label { font-size:0.75rem; letter-spacing:0.1em; background:rgba(7,9,28,0.72); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.08); border-radius:99px; padding:0 14px; }
        }
        @media (max-width: 360px) {
          .ap-phone { transform:scale(0.72); transform-origin:top center; }
          .ap-dots    { margin-top:-42px; }
          .ap-label-wrap { margin-top:-38px; width:190px; }
          .ap-label { font-size:0.72rem; }
        }

        /* ── Virality decorations ────────────────────────────────── */
        @media (min-width: 861px) { .ap-outer { padding: 0 72px; } }
        .vb { position:absolute; pointer-events:none; z-index:4; user-select:none; line-height:1; }
        @media (max-width: 860px) { .vb { display:none; } }

        .vb-thumb   { left:2px; top:138px; font-size:2.6rem; transform:rotate(-22deg); filter:drop-shadow(0 6px 18px rgba(0,212,255,0.45)) drop-shadow(0 2px 4px rgba(0,0,0,0.6)); animation:vbThumb 3.8s ease-in-out infinite; }
        .vb-eyes    { left:14px; top:52px; font-size:1.05rem; transform:rotate(8deg); opacity:0.82; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5)); animation:vbBobSlow 6.2s ease-in-out 1.1s infinite; }
        .vb-comment { left:0px; top:318px; font-size:1.55rem; transform:rotate(12deg); opacity:0.75; filter:drop-shadow(0 3px 10px rgba(255,45,139,0.35)); animation:vbBobL 5s ease-in-out 0.6s infinite; }
        .vb-heart   { right:10px; top:88px; font-size:1.8rem; transform:rotate(10deg); filter:drop-shadow(0 4px 14px rgba(255,45,139,0.6)) drop-shadow(0 1px 3px rgba(0,0,0,0.5)); animation:vbHeartbeat 2s ease-in-out 0.3s infinite; }
        .vb-fire    { right:4px; top:20px; font-size:2.1rem; transform:rotate(6deg); filter:drop-shadow(0 6px 20px rgba(255,100,0,0.55)); animation:vbFireSway 2.4s ease-in-out infinite; }

        .vb-rise { animation:vbRise 3.4s ease-out infinite; filter:drop-shadow(0 2px 6px rgba(255,45,139,0.4)); }
        .vb-rise-1 { right:24px; top:400px; font-size:1.35rem; animation-delay:0.0s; }
        .vb-rise-2 { right:44px; top:418px; font-size:0.9rem;  animation-delay:0.9s; opacity:0.7; }
        .vb-rise-3 { right:16px; top:408px; font-size:1.1rem;  animation-delay:1.8s; }
        .vb-rise-4 { right:38px; top:396px; font-size:0.78rem; animation-delay:2.6s; opacity:0.6; }

        .vb-spark { animation:vbSparkle 2.5s ease-in-out infinite; }
        .vb-spark-1 { left:58px;  top:10px;  font-size:1.1rem;  color:#00D4FF; transform:rotate(20deg);  animation-delay:0s;   filter:drop-shadow(0 0 6px #00D4FF); }
        .vb-spark-2 { right:55px; top:22px;  font-size:0.65rem; color:#FF2D8B; transform:rotate(-12deg); animation-delay:0.9s; filter:drop-shadow(0 0 5px #FF2D8B); }
        .vb-spark-3 { left:52px;  top:484px; font-size:0.85rem; color:#FFB800; transform:rotate(45deg);  animation-delay:1.7s; filter:drop-shadow(0 0 6px #FFB800); }

        @keyframes vbThumb   { 0%{ transform:rotate(-22deg) translateY(0) scale(1); } 30%{ transform:rotate(-14deg) translateY(-10px) scale(1.08); } 60%{ transform:rotate(-26deg) translateY(-5px) scale(0.96); } 100%{ transform:rotate(-22deg) translateY(0) scale(1); } }
        @keyframes vbFireSway{ 0%,100%{ transform:rotate(6deg) scaleX(1); } 33%{ transform:rotate(-4deg) scaleX(0.9); } 66%{ transform:rotate(10deg) scaleX(1.05); } }
        @keyframes vbBobL    { 0%,100%{ transform:rotate(12deg) translateY(0); } 50%{ transform:rotate(9deg) translateY(-8px); } }
        @keyframes vbBobSlow { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
        @keyframes vbHeartbeat { 0%,60%,100%{ transform:rotate(10deg) scale(1); } 15%{ transform:rotate(10deg) scale(1.45); } 30%{ transform:rotate(10deg) scale(1.12); } 45%{ transform:rotate(10deg) scale(1.3); } }
        @keyframes vbRise    { 0%{ opacity:0; transform:translateY(0) scale(0.4) rotate(-10deg); } 10%{ opacity:1; transform:translateY(-18px) scale(1.25) rotate(5deg); } 70%{ opacity:0.55; } 100%{ opacity:0; transform:translateY(-120px) scale(0.6) rotate(15deg); } }
        @keyframes vbSparkle { 0%,100%{ opacity:0.25; transform:var(--sr,rotate(20deg)) scale(0.7); } 50%{ opacity:1; transform:var(--sr,rotate(20deg)) scale(1.5) rotate(180deg); } }

        /* ══════════════════════════════════════════════════════════
           LIGHT MODE OVERRIDES
        ══════════════════════════════════════════════════════════ */
        [data-theme="light"] .lp-hero {
          background: linear-gradient(160deg, #F0F4FF 0%, #E8EDFF 100%);
        }
        [data-theme="light"] .lp-orb-1 {
          background: radial-gradient(ellipse, rgba(0,160,255,0.18) 0%, transparent 65%);
        }
        [data-theme="light"] .lp-orb-2 {
          background: radial-gradient(ellipse, rgba(255,45,139,0.14) 0%, transparent 65%);
        }

        /* Phone shell — thin grey bezel matching login card border */
        [data-theme="light"] .ap-phone {
          background: #E4E8F0;
          padding: 6px;
          border: 1.5px solid #BFC8D6;
          box-shadow: 0 10px 32px rgba(30,50,120,0.12);
        }
        [data-theme="light"] .ap-island {
          background: #2A2F3A;
        }
        [data-theme="light"] .ap-screen {
          border-radius: 28px;
        }

        /* Phone SCREEN — bright app UI in light mode */
        [data-theme="light"] .ap-screen {
          background: linear-gradient(165deg, #FAFBFF 0%, #F0F3FB 100%);
        }
        [data-theme="light"] .ap-screen::after {
          background:
            radial-gradient(ellipse at 20% 10%, rgba(0,160,255,0.06) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 90%, rgba(255,45,139,0.05) 0%, transparent 55%);
        }

        /* Headers — dark text on light */
        [data-theme="light"] .ap-hdr {
          border-bottom: 1px solid rgba(80,100,200,0.16);
        }
        [data-theme="light"] .ap-hdr-title { color: #0A0F2E; font-weight: 900; }
        [data-theme="light"] .ap-field-lbl { color: #4A5878; font-weight: 800; }

        /* Live pill — stays vibrant, contrast on light */
        [data-theme="light"] .ap-live-pill {
          background: rgba(0,150,200,0.10);
          border-color: rgba(0,150,200,0.35);
          color: #0091BB;
        }
        [data-theme="light"] .ap-live-amber {
          background: rgba(200,140,0,0.10);
          border-color: rgba(200,140,0,0.35);
          color: #B07700;
        }
        [data-theme="light"] .ap-badge {
          background: rgba(15,21,53,0.04);
          border: 1px solid rgba(80,100,200,0.14);
        }

        /* Scene 1 — Script Studio */
        [data-theme="light"] .ap-input-row {
          background: rgba(0,160,220,0.07);
          border: 1px solid rgba(0,160,220,0.25);
        }
        [data-theme="light"] .ap-typed-text { color: #0091BB; }
        [data-theme="light"] .ap-cursor { background: #0091BB; }
        [data-theme="light"] .ap-script-line {
          background: #FFFFFF;
          color: #0A0F2E;
          font-weight: 600;
          border-left: 2px solid rgba(80,100,200,0.18);
          box-shadow: 0 2px 6px rgba(30,50,120,0.10);
        }
        [data-theme="light"] .ap-sl-hook { border-left-color: #0091BB; }
        [data-theme="light"] .ap-sl-cta  { border-left-color: #D62478; }
        [data-theme="light"] .ap-tag {
          background: rgba(15,21,53,0.06);
        }

        /* Scene 2 — Hook Score */
        [data-theme="light"] .ap-gauge-bg { stroke: rgba(80,100,200,0.18); }
        [data-theme="light"] .ap-score-sub { color: #4A5878; font-weight: 700; }
        [data-theme="light"] .ap-bar-lbl { color: #2A3458; font-weight: 700; }
        [data-theme="light"] .ap-bar-track { background: rgba(80,100,200,0.14); }

        /* Scene 3 — Crosspost */
        [data-theme="light"] .ap-cp-desc { color: #2A3458; font-weight: 600; }
        [data-theme="light"] .ap-cp-row {
          background: #FFFFFF;
          border: 1px solid rgba(80,100,200,0.14);
          box-shadow: 0 2px 6px rgba(30,50,120,0.10);
        }
        [data-theme="light"] .ap-cp-label { color: #0A0F2E; font-weight: 700; }
        [data-theme="light"] .ap-cp-check {
          color: #1F8000;
          background: rgba(168,255,60,0.22);
          box-shadow: 0 0 10px rgba(100,180,0,0.30);
        }
        [data-theme="light"] .ap-cp-note { color: #4A5878; font-weight: 700; }

        /* Scene 4 — Trending */
        [data-theme="light"] .ap-trend-row {
          background: #FFFFFF;
          border: 1px solid rgba(80,100,200,0.14);
          box-shadow: 0 2px 6px rgba(30,50,120,0.10);
        }
        [data-theme="light"] .ap-trend-tag { color: #0A0F2E; font-weight: 800; }
        [data-theme="light"] .ap-trend-views { color: #4A5878; font-weight: 600; }

        /* Scene 5 — Coach chat */
        [data-theme="light"] .ap-msg-ai {
          background: #FFFFFF;
          color: #0A0F2E;
          font-weight: 600;
          border: 1px solid rgba(80,100,200,0.16);
          box-shadow: 0 2px 6px rgba(30,50,120,0.10);
        }
        [data-theme="light"] .ap-typing {
          background: #FFFFFF;
          border: 1px solid rgba(80,100,200,0.16);
        }
        [data-theme="light"] .ap-typing span { background: rgba(15,21,53,0.55); }

        /* Indicator dots — keep vibrant colours in light mode too */
        [data-theme="light"] .ap-dot-1 { background: #00D4FF; }
        [data-theme="light"] .ap-dot-2 { background: #A8FF3C; }
        [data-theme="light"] .ap-dot-3 { background: #FF2D8B; }
        [data-theme="light"] .ap-dot-4 { background: #FFB800; }
        [data-theme="light"] .ap-dot-5 { background: #A855F7; }

        /* Auth card — crisp white, grey border matching phone */
        [data-theme="light"] .lp-auth-card {
          background: #FFFFFF;
          border: 1.5px solid #BFC8D6;
          box-shadow:
            0 16px 56px rgba(30,50,120,0.16),
            0 4px 12px rgba(30,50,120,0.08),
            0 1px 0 rgba(255,255,255,1) inset;
        }

        /* Auth card content contrast — bolder, darker labels */
        [data-theme="light"] .lp-auth-card .field label {
          color: #0A0F2E;
          font-weight: 800;
        }
        [data-theme="light"] .lp-auth-card .input {
          border: 1.5px solid rgba(80,100,200,0.28);
          color: #0A0F2E;
          font-weight: 500;
        }
        [data-theme="light"] .lp-auth-card .input::placeholder {
          color: #6878A8;
          opacity: 1;
        }

        /* Wordmark — keep gradient, add contrast on light bg */
        [data-theme="light"] .nuove-wordmark {
          filter: drop-shadow(0 1px 2px rgba(15,21,53,0.35))
                  drop-shadow(0 0 10px rgba(0,150,200,0.18));
        }

        /* Navbar text contrast */
        [data-theme="light"] .lp-nav {
          box-shadow: 0 2px 14px rgba(30,50,120,0.06);
        }

        /* Footer in light mode */
        [data-theme="light"] footer {
          background: #FAFBFF !important;
          border-top-color: rgba(80,100,200,0.14) !important;
        }
        [data-theme="light"] footer a,
        [data-theme="light"] footer div {
          color: #2A3458 !important;
          font-weight: 600;
        }

        /* Auth card body text — toggle, fine print, OR */
        [data-theme="light"] .lp-auth-card p {
          color: #2A3458 !important;
        }
        [data-theme="light"] .lp-auth-col > p {
          color: #2A3458 !important;
          font-weight: 600;
        }

        /* Feature label — deeper hues for light background, no stroke needed */
        [data-theme="light"] .ap-label {
          background: none;
          border: none;
          padding: 0;
          box-shadow: none;
          font-weight: 800;
          letter-spacing: 0.12em;
          -webkit-text-stroke: 0;
          paint-order: fill;
          text-shadow: none;
        }
        [data-theme="light"] .ap-label-1 { color: #0284C7; }
        [data-theme="light"] .ap-label-2 { color: #16A34A; }
        [data-theme="light"] .ap-label-3 { color: #DB2777; }
        [data-theme="light"] .ap-label-4 { color: #D97706; }
        [data-theme="light"] .ap-label-5 { color: #7C3AED; }
        [data-theme="light"] .ap-label-wrap {
          height: 32px;
          width: 200px;
        }

      `}</style>
    </div>
  )
}
