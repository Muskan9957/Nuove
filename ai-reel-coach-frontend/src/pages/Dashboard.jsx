import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useTextToSpeech } from '../components/VoiceAssistant'
import { usePrefs } from '../hooks/usePrefs'
import { getSavedRegion } from '../utils/detectRegion'
import ThemeToggle from '../components/ThemeToggle'

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
    speak(`${t('dash_greeting_' + getTimeMood().key)} ${userName}! ${greeting.greeting}`)
    setPlayed(true)
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
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
                    background: 'var(--surface-card-deep)',
                    border: '1px solid rgba(100,140,255,0.18)',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 12,
                    boxShadow: 'var(--card-shadow)',
                    transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.65), 0 0 16px ${color}22`; e.currentTarget.style.borderColor = `${color}44`; e.currentTarget.style.borderLeftColor = color }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.borderColor = 'rgba(100,140,255,0.18)'; e.currentTarget.style.borderLeftColor = color }}
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
      background: 'var(--surface)',
      border: '1px solid var(--border)',
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
function StatTile({ label, value, sub, color, progress }) {
  return (
    <div style={{
      background: 'var(--surface-card-deep)',
      border: '1px solid rgba(100,140,255,0.20)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 14,
      padding: '18px 20px',
      boxShadow: 'var(--card-shadow)',
      transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.65), 0 0 20px ${color}22`; e.currentTarget.style.borderColor = `${color}44`; e.currentTarget.style.borderLeftColor = color }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.borderColor = 'rgba(100,140,255,0.20)'; e.currentTarget.style.borderLeftColor = color }}
    >
      <div style={{
        fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-creator)', fontSize: '2.2rem', fontWeight: 800,
        letterSpacing: '-0.04em', lineHeight: 1, color, marginBottom: 4,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{sub}</div>}
      {progress != null && (
        <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${Math.min(progress, 100)}%`,
            background: progress > 80
              ? `linear-gradient(90deg, ${C.coral}, ${C.pink})`
              : color,
            transition: 'width 0.6s ease',
          }} />
        </div>
      )}
    </div>
  )
}

/* ─── Quick action card ──────────────────────────────────────────── */
function ActionCard({ to, icon, label, color }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '13px 16px',
        display: 'flex', alignItems: 'center', gap: 11,
        cursor: 'pointer',
        transition: 'all 0.18s',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${color}66`
          e.currentTarget.style.background = `${color}0C`
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.background = 'var(--surface)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `${color}18`, border: `1px solid ${color}33`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', color,
        }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>
          {label}
        </span>
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

  const limit  = { FREE: 5, STARTER: 50, PRO: '∞' }[user?.plan] || 5
  const used   = user?.generationsUsed || 0
  const pct    = limit === '∞' ? 100 : Math.round((used / limit) * 100)
  const streak = profile?.streak || 0
  const firstName = user?.name?.split(' ')[0] || 'Creator'
  const mood = getTimeMood()

  return (
    <div className="page-enter" style={{ position: 'relative' }}>

      {/* ─── Theme toggle — top-right of dashboard ───────────────── */}
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
        <ThemeToggle size="sm" />
      </div>

      {/* ─── Greeting ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 99,
          background: `${mood.color}14`,
          border: `1px solid ${mood.color}40`,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: '0.92rem' }}>{mood.emoji}</span>
          <span style={{
            fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: mood.color, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {mood.label}
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-creator)', fontWeight: 800,
          fontSize: 'clamp(2rem, 4vw, 2.8rem)',
          letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 8,
        }}>
          {t('dash_greeting_' + mood.key)},{' '}
          <span style={{
            background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.pink} 50%, ${C.amber} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {firstName}
          </span>
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', maxWidth: 600, lineHeight: 1.55, margin: 0 }}>
          {t('dash_overview')}
        </p>
      </div>

      {/* ─── Active niche chips ──────────────────────────────────── */}
      {niches.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>
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

      {/* ─── Today's Brief ───────────────────────────────────────── */}
      <TrendingBrief userName={firstName} niches={niches} />

      {/* ─── Stats row ───────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        <StatTile
          label="Scripts Written"
          value={scripts.length}
          sub={scripts.length > 0 ? 'all-time total' : 'Start creating!'}
          color={C.cyan}
        />
        <StatTile
          label="Videos Analysed"
          value={logs.length}
          sub={logs.length > 0 ? 'performance tracked' : 'Analyse a reel'}
          color={C.lime}
        />
        <StatTile
          label="Badges Earned"
          value={badges.length}
          sub={badges.length === 0 ? 'Keep creating to unlock!' : `Latest: ${BADGE_META[badges[badges.length - 1]?.type]?.emoji ?? '🏅'} ${BADGE_META[badges[badges.length - 1]?.type]?.label ?? badges[badges.length - 1]?.type}`}
          color={C.amber}
        />
      </div>


      {/* ─── Streak chip ─────────────────────────────────────────── */}
      {streak > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          padding: '12px 18px',
          background: 'var(--surface)',
          border: `1px solid ${C.amber}40`,
          borderRadius: 14,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>🔥</div>
          <div>
            <span style={{
              fontFamily: 'var(--font-creator)', fontWeight: 800, fontSize: '1.4rem',
              color: C.amber, letterSpacing: '-0.02em',
            }}>{streak}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 600 }}>
              {t('dash_day_streak')}
            </span>
          </div>
        </div>
      )}

      {/* ─── Badges ──────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{
            fontFamily: 'var(--font-head)', fontSize: '0.74rem', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em',
            marginBottom: 10,
          }}>{t('dash_badges')}</h2>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {badges.map((badge, i) => {
              const meta = BADGE_META[badge.type || badge] || { emoji: '⭐', label: badge.type || badge }
              return (
                <div key={i} title={meta.label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, flexShrink: 0, minWidth: 84,
                }}>
                  <span style={{ fontSize: '1.3rem' }}>{meta.emoji}</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}


      {/* ─── Upgrade banner ──────────────────────────────────────── */}
      {user?.plan === 'FREE' && (
        <div style={{
          marginTop: 32,
          background: 'var(--surface)',
          border: `1px solid ${C.pink}33`,
          borderRadius: 16,
          padding: '20px 24px',
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
