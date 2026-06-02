import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useTextToSpeech } from '../components/VoiceAssistant'
import { usePrefs } from '../hooks/usePrefs'
import { getSavedRegion } from '../utils/detectRegion'
import { useTheme } from '../context/ThemeContext'

/* ─── Inject Syne display font ───────────────────────────────────── */
if (!document.getElementById('syne-font')) {
  const _l = document.createElement('link')
  _l.id = 'syne-font'; _l.rel = 'stylesheet'
  _l.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap'
  document.head.appendChild(_l)
}


/* ─── Creator palette ────────────────────────────────────────────── */
const C = {
  cyan:   '#00D4FF',
  pink:   '#FF2D8B',
  lime:   '#A8FF3C',
  amber:  '#FFB800',
  coral:  '#FF5F4C',
  violet: '#A855F7',
  teal:   '#00D4B1',
}

/* ─── Light-mode pastel card backgrounds ────────────────────────── */
const PASTEL = {
  sky:    'rgba(219,234,254,0.95)',
  rose:   'rgba(252,231,243,0.95)',
  mint:   'rgba(209,250,229,0.95)',
  violet: 'rgba(237,233,254,0.95)',
  amber:  'rgba(254,243,199,0.95)',
  lime:   'rgba(220,252,231,0.95)',
}
const PASTEL_LIST = [PASTEL.sky, PASTEL.rose, PASTEL.mint, PASTEL.violet, PASTEL.amber, PASTEL.lime]

const NICHE_META = {
  comedy:        { emoji: '😂', color: '#FF2D8B' },
  fitness:       { emoji: '💪', color: '#00D4FF' },
  finance:       { emoji: '💰', color: '#A8FF3C' },
  food:          { emoji: '🍜', color: '#FFB800' },
  fashion:       { emoji: '👗', color: '#FF2D8B' },
  tech:          { emoji: '⚡', color: '#A855F7' },
  lifestyle:     { emoji: '✨', color: '#00D4B1' },
  education:     { emoji: '📚', color: '#A855F7' },
  travel:        { emoji: '🗺️', color: '#00D4FF' },
  motivation:    { emoji: '🔥', color: '#FFB800' },
  business:      { emoji: '🚀', color: '#00D4B1' },
  relationships: { emoji: '❤️', color: '#FF5F4C' },
}

const BADGE_META = {
  FIRST_SCRIPT: { emoji: '🎬', label: 'First Script'    },
  SCRIPTS_10:   { emoji: '📚', label: '10 Scripts'       },
  SCRIPTS_50:   { emoji: '🏆', label: '50 Scripts'       },
  PERFECT_HOOK: { emoji: '💯', label: 'Perfect Hook'     },
  ANALYZER_5:   { emoji: '📊', label: '5 Analyses'       },
  STREAK_7:     { emoji: '🔥', label: '7-Day Streak'     },
  STREAK_30:    { emoji: '⚡', label: '30-Day Streak'    },
}

const CATEGORY_COLORS = {
  Entertainment: C.pink,    Finance: C.lime,    Lifestyle: C.amber,
  Sports:        C.violet,  Business: C.teal,   Tech:      C.cyan,
  Content:       C.pink,    Strategy: C.amber,  Health:    C.lime,
  Fashion:       C.coral,   Bollywood: C.pink,  Cricket:   C.lime,
  Education:     C.violet,  Food:      C.coral,
}

function getTimeMood() {
  const h = new Date().getHours()
  if (h < 5)  return { key: 'evening',   emoji: '🌙', label: 'late-night creator', color: C.violet }
  if (h < 12) return { key: 'morning',   emoji: '☀️', label: 'fresh start',         color: C.amber  }
  if (h < 17) return { key: 'afternoon', emoji: '🔆', label: 'in the zone',         color: C.cyan   }
  if (h < 21) return { key: 'evening',   emoji: '✨', label: 'golden hour',         color: C.coral  }
  return            { key: 'evening',   emoji: '🌙', label: 'late-night creator', color: C.violet }
}

/* ─── Today's Brief ──────────────────────────────────────────────── */
const BRIEF_CACHE_KEY = 'arc_brief_cache'

function TrendingBrief({ userName, niches = [] }) {
  const { t, lang } = useLang()
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { speak, speaking, stopSpeaking } = useTextToSpeech()
  const [played, setPlayed] = useState(false)
  const primaryNiche = niches[0] || ''

  // Cache key is unique per niche selection + lang + date
  const cacheKey = `${BRIEF_CACHE_KEY}_${niches.join(',')}_${lang}`

  // Load from localStorage instantly so screen never shows blank
  const [greeting, setGreeting] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (c?.date === new Date().toISOString().slice(0,10)) return c.data
    } catch {}
    return null
  })
  const [loading, setLoading] = useState(!greeting)

  useEffect(() => {
    const region = getSavedRegion() || 'India'
    const today  = new Date().toISOString().slice(0, 10)

    const greetingPromise = api.getGreeting(region, lang, niches)
    // If user has a niche, also pull niche-specific trending topics
    const trendingPromise = primaryNiche
      ? api.getTrending(primaryNiche, lang).catch(() => null)
      : Promise.resolve(null)

    Promise.all([greetingPromise, trendingPromise])
      .then(([greetData, trendData]) => {
        // Merge niche-specific trends over the generic greeting trends
        const merged = {
          ...greetData,
          trends: trendData?.trends?.length ? trendData.trends : greetData?.trends,
          nicheLabel: primaryNiche ? primaryNiche.charAt(0).toUpperCase() + primaryNiche.slice(1) : null,
        }
        setGreeting(merged)
        localStorage.setItem(cacheKey, JSON.stringify({ data: merged, date: today }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang, niches.join(',')])

  const playGreeting = () => {
    if (!greeting) return
    if (speaking) { stopSpeaking(); return }
    
    let text = `${t('dash_greeting_' + getTimeMood().key)} ${userName}! ${greeting.greeting}`
    
    // Dynamically append the top 3 trends if they exist
    if (greeting.trends && greeting.trends.length > 0) {
      // Ensure we clean up the trend titles slightly for speech (e.g. removing emojis if necessary, though TTS usually handles them okay or ignores them)
      const topTrends = greeting.trends.slice(0, 3).map(trend => trend.title).join(', ')
      text += ` Today's top trending topics are: ${topTrends}.`
    }
    
    speak(text)
    setPlayed(true)
  }

  return (
    <div style={{
      background: isLight
        ? `linear-gradient(145deg, ${PASTEL.rose} 0%, rgba(255,255,255,0.96) 100%)`
        : 'linear-gradient(135deg, rgba(0,160,255,0.07) 0%, var(--surface) 50%)',
      border: isLight ? '1px solid rgba(219,39,119,0.18)' : '1px solid var(--border)',
      borderTop: isLight ? '2px solid rgba(219,39,119,0.30)' : '2px solid rgba(0,160,255,0.22)',
      borderRadius: 18,
      padding: '22px 26px',
      marginBottom: 24,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.74rem', fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)', letterSpacing: '0.1em',
          textTransform: 'uppercase', fontWeight: 700,
        }}>
          {t('dash_todays_brief')}
        </span>
        {/* Niche badge */}
        {greeting?.nicheLabel && (
          <span style={{
            fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em',
            background: `${C.violet}18`, border: `1px solid ${C.violet}40`, color: C.violet,
            textTransform: 'uppercase',
          }}>
            {greeting.nicheLabel}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={playGreeting}
          disabled={!greeting}
          style={{
            padding: '6px 14px', borderRadius: 99,
            border: `1px solid ${speaking ? C.teal : 'var(--border)'}`,
            background: speaking ? `${C.teal}1A` : 'transparent',
            color: speaking ? C.teal : 'var(--text-faint)',
            cursor: greeting ? 'pointer' : 'not-allowed',
            fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {speaking ? t('dash_stop') : played ? t('dash_replay') : t('dash_listen')}
        </button>
      </div>

      {/* No niche set — prompt user to personalise */}
      {!loading && niches.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
          padding: '14px 16px', borderRadius: 12,
          background: `${C.amber}0D`, border: `1px solid ${C.amber}30`,
          marginBottom: greeting ? 14 : 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
              📌 Personalise your brief
            </p>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-faint)' }}>
              Set your niche to get content ideas tailored to your audience
            </p>
          </div>
          <Link
            to="/profile"
            style={{
              textDecoration: 'none', flexShrink: 0,
              padding: '7px 16px', borderRadius: 99,
              background: C.amber, color: '#000',
              fontSize: '0.78rem', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            Set niche →
          </Link>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>{t('dash_loading_trends')}</span>
        </div>
      ) : greeting ? (
        <>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            {greeting.greeting}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
          }}>
            {greeting.trends?.slice(0, 3).map((trend, i) => {
              const color = CATEGORY_COLORS[trend.category] || CATEGORY_COLORS[primaryNiche] || C.cyan
              return (
                <Link
                  key={i}
                  to="/generate"
                  state={{ topic: trend.title, niche: primaryNiche || trend.category?.toLowerCase() }}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    height: '100%',
                    padding: 14,
                    background: isLight
                      ? `linear-gradient(145deg, ${PASTEL_LIST[i % PASTEL_LIST.length]} 0%, rgba(255,255,255,0.98) 100%)`
                      : 'var(--surface-card-deep)',
                    border: isLight ? `1px solid ${color}30` : '1px solid rgba(100,140,255,0.18)',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 12,
                    boxShadow: 'var(--card-shadow)',
                    transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(30,50,120,0.15), 0 0 16px ${color}22`; e.currentTarget.style.borderColor = `${color}44`; e.currentTarget.style.borderLeftColor = color }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.borderColor = isLight ? `${color}30` : 'rgba(100,140,255,0.18)'; e.currentTarget.style.borderLeftColor = color }}
                  >
                    <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                      {trend.category}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 5, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                      {trend.title}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-faint)', lineHeight: 1.5 }}>
                      {trend.description}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        /* API failed / no data — show fallback instead of blank */
        !niches.length ? null : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', margin: 0 }}>
            Could not load today's trends. <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', color: C.cyan, cursor: 'pointer', fontSize: 'inherit', padding: 0, textDecoration: 'underline' }}>Retry</button>
          </p>
        )
      )}
    </div>
  )
}

/* ─── Creator Score (horizontal) ─────────────────────────────────── */
function CreatorScoreCard({ score }) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [copied, setCopied] = useState(false)

  if (!score) return null

  const { score: val, breakdown = {}, level } = score
  const segments = [
    { key: 'consistency',  label: t('dash_seg_consistency'), color: C.lime  },
    { key: 'hookQuality',  label: t('dash_seg_hook'),        color: C.cyan  },
    { key: 'performance',  label: t('dash_seg_performance'), color: C.pink  },
    { key: 'streakBonus',  label: t('dash_seg_streak'),      color: C.amber },
  ]
  const total = segments.reduce((acc, s) => acc + (breakdown[s.key] || 0), 0) || 1

  const shareScore = async () => {
    try {
      await navigator.clipboard.writeText(`My Nuove Creator Score: ${val} — ${level || 'Rising Creator'} 🚀`)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div style={{
      background: isLight
        ? `linear-gradient(145deg, ${PASTEL.violet} 0%, rgba(255,255,255,0.96) 100%)`
        : `linear-gradient(135deg, ${C.cyan}10 0%, var(--surface) 52%, ${C.pink}07 100%)`,
      border: isLight ? '1px solid rgba(109,40,217,0.20)' : '1px solid var(--border)',
      borderTop: isLight ? '2px solid rgba(109,40,217,0.30)' : `2px solid ${C.cyan}44`,
      borderRadius: 18,
      padding: '22px 26px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        {/* Score + Level */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontFamily: 'var(--font-creator)', fontWeight: 800,
            fontSize: '3.4rem', lineHeight: 0.95, letterSpacing: '-0.04em',
            background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.pink} 55%, ${C.amber} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {val}
          </div>
          <div style={{
            fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginTop: 6,
          }}>
            {level || 'Rising Creator'}
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{
            fontSize: '0.7rem', color: 'var(--text-faint)',
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10,
          }}>
            {t('dash_score_breakdown')}
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
            {segments.map(seg => {
              const v = breakdown[seg.key] || 0
              const pct = (v / total) * 100
              return (
                <div key={seg.key} title={`${seg.label}: ${v}`} style={{
                  flex: pct, minWidth: pct > 0 ? 4 : 0, borderRadius: 99,
                  background: seg.color,
                  transition: 'flex 0.4s ease',
                }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {segments.map(seg => (
              <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {seg.label} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{breakdown[seg.key] ?? '—'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Share */}
        <button
          onClick={shareScore}
          style={{
            padding: '9px 16px', borderRadius: 10,
            border: `1px solid ${copied ? C.teal : 'var(--border)'}`,
            background: copied ? `${C.teal}14` : 'transparent',
            color: copied ? C.teal : 'var(--text-muted)',
            fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          {copied ? t('dash_score_copied') : t('dash_share_score')}
        </button>
      </div>
    </div>
  )
}

/* ─── Stat tile ──────────────────────────────────────────────────── */
function StatTile({ label, value, sub, color, progress, icon }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  return (
    <div style={{
      background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.025)',
      border: `1px solid ${isLight ? color + '22' : color + '14'}`,
      borderRadius: 20,
      padding: '22px 24px',
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 20px 56px ${color}22` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Glow blob top-right */}
      <div style={{ position: 'absolute', top: -28, right: -28, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle, ${color}35 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-faint)' }}>{label}</span>
        {icon && <span style={{ fontSize: '1rem', lineHeight: 1, opacity: 0.7 }}>{icon}</span>}
      </div>

      {/* Big number */}
      <div style={{ fontFamily: "'Syne', var(--font-creator)", fontSize: '3.2rem', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, color, marginBottom: 8 }}>
        {value}
      </div>

      {sub && <div style={{ fontSize: '0.71rem', color: 'var(--text-faint)', lineHeight: 1.45 }}>{sub}</div>}

      {progress != null && (
        <div style={{ height: 3, background: isLight ? `${color}18` : 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(progress, 100)}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      )}
    </div>
  )
}

/* ─── Quick action card ──────────────────────────────────────────── */
function ActionCard({ to, icon, label, sub, color }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: isLight
          ? `linear-gradient(140deg, ${color}14 0%, rgba(255,255,255,0.96) 100%)`
          : `linear-gradient(140deg, ${color}0A 0%, rgba(255,255,255,0.012) 100%)`,
        border: `1px solid ${isLight ? color + '20' : color + '18'}`,
        borderRadius: 18,
        padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${color}48`; e.currentTarget.style.boxShadow = `0 10px 36px ${color}1A` }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = isLight ? `${color}20` : `${color}18`; e.currentTarget.style.boxShadow = 'none' }}
      >
        {/* Icon square */}
        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
          {icon}
        </div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Syne', var(--font-creator)", fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', letterSpacing: '-0.015em', marginBottom: 2 }}>{label}</div>
          {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', lineHeight: 1.3 }}>{sub}</div>}
        </div>
        {/* Arrow */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </Link>
  )
}

/* ─── Dashboard ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user }          = useAuth()
  const { t, lang }       = useLang()
  const { niches, goals, platform } = usePrefs()
  const [scripts, setSc]  = useState([])
  const [logs, setLogs]   = useState([])
  const [badges, setBadges] = useState([])
  const [profile, setProfile] = useState(null)
  const [creatorScore, setCreatorScore] = useState(null)
  const [loading, setLd]  = useState(true)

  useEffect(() => {
    Promise.all([
      api.getScripts().catch(() => ({ scripts: [] })),
      api.perfHistory().catch(() => ({ logs: [] })),
      api.getBadges().catch(() => ({ badges: [] })),
      api.getUserProfile().catch(() => null),
      api.getCreatorScore().catch(() => null),
    ])
      .then(([s, p, b, prof, cs]) => {
        setSc(s.scripts || [])
        setLogs(p.logs || [])
        setBadges(b.badges || [])
        setProfile(prof)
        setCreatorScore(cs)

        // Sync prefs from backend → localStorage for users on a new device
        // or those who skipped onboarding but later saved prefs via profile
        if (prof?.niches?.length) {
          try {
            const stored = JSON.parse(localStorage.getItem('vs_prefs') || '{}')
            if (!stored.niches?.length) {
              localStorage.setItem('vs_prefs', JSON.stringify({
                niches:   prof.niches,
                platform: prof.platform || stored.platform || null,
                goals:    prof.goals    || stored.goals    || [],
              }))
            }
          } catch {}
        }
      })
      .finally(() => setLd(false))
  }, [])

  const { theme } = useTheme()
  const isLight = theme === 'light'
  const limit  = { FREE: 5, STARTER: 50, PRO: '∞' }[user?.plan] || 5
  const used   = user?.generationsUsed || 0
  const pct    = limit === '∞' ? 100 : Math.round((used / limit) * 100)
  const streak = profile?.streak || 0
  const firstName = user?.name?.split(' ')[0] || 'Creator'
  const mood = getTimeMood()

  return (
    <div className="page-enter" style={{ position: 'relative' }}>

      {/* ─── Greeting ────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        {/* Mood pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 99,
          background: `${mood.color}10`,
          border: `1px solid ${mood.color}25`,
          marginBottom: 18,
        }}>
          <span style={{ fontSize: '0.88rem' }}>{mood.emoji}</span>
          <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: mood.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {mood.label}
          </span>
        </div>

        {/* Big name greeting */}
        <h1 style={{
          fontFamily: "'Syne', var(--font-creator)",
          fontSize: 'clamp(2rem, 5vw, 2.9rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          marginBottom: 12,
          color: 'var(--text)',
        }}>
          {t('dash_greeting_' + mood.key)},&nbsp;
          <span style={{
            background: `linear-gradient(135deg, ${mood.color} 0%, ${C.pink} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>{firstName}.</span>
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 480, lineHeight: 1.65, margin: 0 }}>
          {t('dash_overview')}
        </p>
      </div>

      {/* ─── Active niche chips ───────────────────────────── */}
      {niches.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <span style={{ fontSize: '0.63rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>
            Active niche
          </span>
          {niches.map(n => {
            const meta = NICHE_META[n] || { emoji: '🎯', color: C.cyan }
            return (
              <Link key={n} to={`/trending`} style={{ textDecoration: 'none' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 99,
                  background: `${meta.color}14`, border: `1px solid ${meta.color}40`,
                  color: meta.color, fontSize: '0.75rem', fontWeight: 700,
                  fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  transition: 'all 0.15s',
                  letterSpacing: '0.03em',
                }}>
                  {meta.emoji} {n.charAt(0).toUpperCase() + n.slice(1)}
                </span>
              </Link>
            )
          })}
          <Link to="/profile" style={{ textDecoration: 'none', fontSize: '0.68rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginLeft: 2 }}>
            edit →
          </Link>
        </div>
      )}

      {/* ─── Quick Actions 2x2 grid ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 28 }}>
        <ActionCard to="/generate" icon="✍️" label="Generate Script" sub="AI-powered in seconds" color={C.cyan} />
        <ActionCard to="/record"   icon="🎥" label="Record"          sub="Teleprompter + camera" color={C.pink} />
        <ActionCard to="/trending" icon="📈" label="Trending"         sub="What's hot right now" color={C.lime} />
        <ActionCard to="/captions" icon="🏷️" label="Captions"         sub="Write, hashtag, publish" color={C.amber} />
      </div>

      {/* ─── Today's Brief ───────────────────────────────────── */}
      <TrendingBrief userName={firstName} niches={niches} />

      {/* ─── Stats row ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatTile label="Scripts Written" value={scripts.length} icon="✍️"
          sub={scripts.length > 0 ? 'all-time total' : 'Start creating!'} color={C.cyan} />
        <StatTile label="Videos Analysed" value={logs.length} icon="📊"
          sub={logs.length > 0 ? 'performance tracked' : 'Analyse a reel'} color={C.lime} />
        <StatTile label="Badges Earned" value={badges.length} icon="🏅"
          sub={badges.length === 0 ? 'Keep creating to unlock!' : `Latest: ${BADGE_META[badges[badges.length - 1]?.type]?.emoji ?? '🏅'} ${BADGE_META[badges[badges.length - 1]?.type]?.label ?? badges[badges.length - 1]?.type}`}
          color={C.amber} />
      </div>

      {/* ─── Streak chip ───────────────────────────────────────── */}
      {streak > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          padding: '14px 22px',
          background: isLight ? 'rgba(255,255,255,0.85)' : `rgba(255,184,0,0.05)`,
          border: `1px solid ${C.amber}22`,
          borderRadius: 18, marginBottom: 28,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, left: -10, width: 70, height: 70, borderRadius: '50%', background: `radial-gradient(circle, ${C.amber}35 0%, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ fontSize: '2.2rem', lineHeight: 1, position: 'relative' }}>🔥</div>
          <div>
            <span style={{ fontFamily: "'Syne', var(--font-creator)", fontWeight: 800, fontSize: '1.8rem', color: C.amber, letterSpacing: '-0.04em' }}>{streak}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 10, fontWeight: 600 }}>
              {t('dash_day_streak')}
            </span>
          </div>
        </div>
      )}

      {/* ─── Badges ────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Syne', var(--font-creator)", fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 14 }}>{t('dash_badges')}</h2>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
            {badges.map((badge, i) => {
              const meta = BADGE_META[badge.type || badge] || { emoji: '⭐', label: badge.type || badge }
              const bColor = [C.violet, C.amber, C.cyan, C.pink, C.lime, C.coral][i % 6]
              return (
                <div key={i} title={meta.label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  padding: '14px 16px',
                  background: isLight ? 'rgba(255,255,255,0.85)' : `${bColor}07`,
                  border: `1px solid ${bColor}20`,
                  borderRadius: 16, flexShrink: 0, minWidth: 82,
                  position: 'relative', overflow: 'hidden',
                  transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
                  cursor: 'default',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 10px 28px ${bColor}20` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ position: 'absolute', top: -15, right: -15, width: 50, height: 50, borderRadius: '50%', background: `radial-gradient(circle, ${bColor}35 0%, transparent 70%)`, pointerEvents: 'none' }} />
                  <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{meta.emoji}</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Upgrade banner ───────────────────────────────────── */}
      {user?.plan === 'FREE' && (
        <div style={{
          marginTop: 32,
          background: isLight
            ? 'rgba(255,255,255,0.88)'
            : `linear-gradient(135deg, ${C.cyan}0C 0%, transparent 50%, ${C.pink}08 100%)`,
          border: isLight ? `1px solid ${C.cyan}28` : `1px solid ${C.pink}30`,
          borderRadius: 20,
          padding: '22px 26px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-creator)', fontWeight: 800, fontSize: '1.15rem',
              letterSpacing: '-0.02em', marginBottom: 4,
              background: `linear-gradient(135deg, ${C.cyan}, ${C.pink} 60%, ${C.amber})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {t('dash_unlock_title')}
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              <span style={{ color: C.pink, fontWeight: 700 }}>{used}/{limit}</span> {t('generate_usage')} · {t('dash_free_desc')}
            </div>
          </div>
          <Link to="/pricing" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            {t('dash_upgrade_btn')}
          </Link>
        </div>
      )}

    </div>
  )
}
