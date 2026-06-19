import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useTextToSpeech } from '../components/VoiceAssistant'
import { usePrefs } from '../hooks/usePrefs'
import { getSavedRegion } from '../utils/detectRegion'
import { useTheme } from '../context/ThemeContext'
import TrendDetailModal from '../components/TrendDetailModal'

/* ─── Creator palette ,  Saffron Noir ─────────────────────────────── */
const C = {
  cyan:   '#FF8C00',
  pink:   '#FF2D6F',
  lime:   '#C4FF00',
  amber:  '#FF8C00',
  coral:  '#FF5F4C',
  violet: '#B36DFF',
  teal:   '#00E5A0',
  green:  '#10B981',
}

const NICHES = [
  'All',
  'AI & Technology',
  'Gaming',
  'Business & Finance',
  'Fitness',
  'Photography',
  'Filmmaking',
  'Geopolitics',
  'Travel',
  'Food',
  'Sports',
  'Music',
  'Movies & Entertainment'
]

const NICHE_META = {
  'ai & technology': { emoji: '⚡', color: C.cyan },
  'gaming': { emoji: '🎮', color: C.violet },
  'business & finance': { emoji: '🚀', color: C.green },
  'fitness': { emoji: '💪', color: C.lime },
  'photography': { emoji: '📸', color: C.violet },
  'filmmaking': { emoji: '🎬', color: C.pink },
  'geopolitics': { emoji: '🌍', color: C.amber },
  'travel': { emoji: '✈️', color: C.teal },
  'food': { emoji: '🍜', color: C.amber },
  'sports': { emoji: '⚽', color: C.pink },
  'music': { emoji: '🎵', color: C.pink },
  'movies & entertainment': { emoji: '🍿', color: C.pink },
  'general': { emoji: '✨', color: C.violet },
}

const BADGE_META = {
  FIRST_SCRIPT: { emoji: '🎬', label: 'First Script', desc: 'Generate your first script using the Script Generator' },
  SCRIPTS_5:    { emoji: '🔥', label: '5 Scripts', desc: 'Generate 5 scripts in total' },
  SCRIPTS_15:   { emoji: '📚', label: '15 Scripts', desc: 'Generate 15 scripts in total' },
  SCRIPTS_50:   { emoji: '🏆', label: '50 Scripts', desc: 'Generate 50 scripts in total' },
  STREAK_5:     { emoji: '🏃', label: '5-Day Streak', desc: 'Maintain a 5-day daily active streak' },
  STREAK_15:    { emoji: '⚡', label: '15-Day Streak', desc: 'Maintain a 15-day daily active streak' },
  STREAK_30:    { emoji: '👑', label: '30-Day Streak', desc: 'Maintain a 30-day daily active streak' },
  PERFECT_HOOK: { emoji: '💯', label: 'Perfect Hook', desc: 'Get a hook score of 90 or higher on any hook' },
  ANALYZER_5:   { emoji: '📊', label: '5 Analyses', desc: 'Analyze at least 5 video performance logs' },
}

const CATEGORY_COLORS = {
  'AI & Technology': C.cyan,
  'Gaming': C.violet,
  'Business & Finance': C.green,
  'Fitness': C.cyan,
  'Photography': C.violet,
  'Filmmaking': C.pink,
  'Geopolitics': C.amber,
  'Travel': C.teal,
  'Food': C.amber,
  'Sports': C.pink,
  'Music': C.pink,
  'Movies & Entertainment': C.pink,
}

export function normalizeFrontendNiche(n) {
  if (!n) return 'All'
  const lower = n.toLowerCase().trim()
  if (lower === 'finance' || lower === 'business' || lower === 'business & startups' || lower === 'business startups') {
    return 'Business & Finance'
  }
  if (lower === 'fashion' || lower === 'education' || lower === 'memes') {
    return 'All'
  }
  const found = NICHES.find(v => v.toLowerCase() === lower)
  return found || 'All'
}

function getTimeMood() {
  const h = new Date().getHours()
  if (h < 5)  return { key: 'evening',   emoji: '🌙', label: 'late-night creator', color: C.violet }
  if (h < 12) return { key: 'morning',   emoji: '☀️', label: 'fresh start',         color: C.amber  }
  if (h < 17) return { key: 'afternoon', emoji: '🔆', label: 'in the zone',         color: C.cyan   }
  if (h < 21) return { key: 'evening',   emoji: '✨', label: 'golden hour',         color: C.coral  }
  return             { key: 'evening',   emoji: '🌙', label: 'late-night creator', color: C.violet }
}

/* Virality heat ,  3 cards: rank 1 = 94%, 2 = 78%, 3 = 61% */
const VIRALITY = [94, 78, 61]

/* "Freshness" badge driven by rank */
const TREND_BADGE = ['🔥 HOT', '⚡ RISING', '✨ NEW']

function timeAgo(ts) {
  if (!ts) return null
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1)  return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  return `${h}h ago`
}

/* ─── Pulsing LIVE dot ────────────────────────────────────────────── */
function LiveDot() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 10, height: 10 }}>
      <span style={{
        position: 'absolute', width: 18, height: 18, borderRadius: '50%',
        background: '#FF2D6F', opacity: 0,
        animation: 'livePulse 1.8s ease-out infinite',
      }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF2D6F', flexShrink: 0 }} />
    </span>
  )
}

/* ─── Today's Brief ,  editorial redesign ─────────────────────────── */
function TrendingBrief({ userName }) {
  const { t, lang } = useLang()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const isLight = theme === 'light'
  const { speaking, preparing, speak, stopSpeaking, prefetch } = useTextToSpeech()
  const [played, setPlayed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [scope, setScope] = useState('local')
  const scopeRef = useRef('local')

  const [niche, setNiche] = useState('All')
  const nicheRef = useRef('All')
  const [showNicheMenu, setShowNicheMenu] = useState(false)
  const nicheMenuRef = useRef(null)
  const [selectedTrend, setSelectedTrend] = useState(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (nicheMenuRef.current && !nicheMenuRef.current.contains(event.target)) {
        setShowNicheMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const [greeting, setGreeting]             = useState(null)
  const [trends, setTrends]                 = useState([])
  const [trendFetchedAt, setTrendFetchedAt] = useState(null)
  const [audioTracks, setAudioTracks]       = useState([])
  const [audioLoading, setAudioLoading]     = useState(false)
  const [loading, setLoading]               = useState(true)

  const SOURCE_META = {
    google:  { label: '🔍 Google Trends', color: '#4285F4' },
    youtube: { label: '📺 YouTube',        color: '#FF0000' },
    ai:      { label: '✨ AI Pick',         color: C.violet  },
  }

  const fetchBrief = useCallback((force = false) => {
    if (force) setRefreshing(true)
    else setLoading(true)

    const region = scopeRef.current === 'global' ? 'Global' : (getSavedRegion() || 'India')
    const rawNiche = nicheRef.current
    const activeNiche = rawNiche === 'All' ? 'general' : rawNiche
    const currentScope = scopeRef.current

    const ts = Date.now()
    const today = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
    const bust = `&_t=${ts}&date=${today}`

    const greetingPromise = api.getGreeting(region, lang, bust, activeNiche, currentScope).catch(() => null)
    const trendingPromise = api.getTrending(lang, region, force, activeNiche, currentScope).catch(() => null)

    Promise.all([greetingPromise, trendingPromise])
      .then(([greetData, trendData]) => {
        if (scopeRef.current !== currentScope || nicheRef.current !== rawNiche) return
        if (greetData) {
          setGreeting(greetData)
        }
        
        const liveTrends = trendData?.topics?.length
          ? trendData.topics
          : (trendData?.trends?.length ? trendData.trends : greetData?.trends)

        if (liveTrends && liveTrends.length > 0) {
          setTrends(liveTrends)
          setTrendFetchedAt(trendData?.fetchedAt || Date.now())
        } else {
          setTrends([])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (scopeRef.current === currentScope && nicheRef.current === rawNiche) {
          setLoading(false)
          setRefreshing(false)
        }
      })
  }, [lang])

  const fetchAudio = useCallback(() => {
    const region = getSavedRegion() || 'India'
    setAudioLoading(true)
    api.getTrendingAudio(region)
      .then(data => setAudioTracks(data?.tracks || []))
      .catch(() => {})
      .finally(() => setAudioLoading(false))
  }, [])

  const handleScopeChange = (newScope) => {
    if (newScope === scopeRef.current) return
    scopeRef.current = newScope
    setScope(newScope)
    setGreeting(null)
    setTrends([])
    setLoading(true)
    setRefreshing(false)
    fetchBrief(true)
  }

  const handleNicheChange = (newNiche) => {
    if (newNiche === nicheRef.current) return
    nicheRef.current = newNiche
    setNiche(newNiche)
    setGreeting(null)
    setTrends([])
    setLoading(true)
    setRefreshing(false)
    fetchBrief(true)
  }

  useEffect(() => { fetchBrief(false); fetchAudio() }, [lang])

  // Generate text for TTS
  const getGreetingText = useCallback(() => {
    if (!greeting) return ''
    let text = `${t('dash_greeting_' + getTimeMood().key)} ${userName}! ${greeting.greeting}`
    if (trends?.length) {
      const topTrends = trends.slice(0, 3).map(tr => typeof tr === 'string' ? tr : tr.text || tr.title).join(', ')
      text += ` Today's top trending topics are: ${topTrends}.`
    }
    return text
  }, [greeting, trends, userName, t])

  // Prefetch TTS audio when greeting/trends load
  useEffect(() => {
    const text = getGreetingText()
    if (text) prefetch(text)
  }, [getGreetingText, prefetch])

  const playGreeting = () => {
    const text = getGreetingText()
    if (!text) return
    if (speaking || preparing) { stopSpeaking(); return }
    speak(text)
    setPlayed(true)
  }

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const ago   = timeAgo(trendFetchedAt)

  return (
    <section style={{ marginBottom: 32 }}>

      {/* ── Section header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* LIVE badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 99,
          background: 'rgba(255,45,111,0.10)',
          border: '1px solid rgba(255,45,111,0.28)',
        }}>
          <LiveDot />
          <span style={{
            fontSize: '0.64rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: C.pink, textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>Live</span>
        </div>

        <h2 style={{
          margin: 0, fontSize: '1.05rem', fontFamily: 'var(--font-creator)',
          fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)',
        }}>
          {t('dash_todays_brief')}
        </h2>
        </div>

        {/* Local / Global Toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', background: 'var(--surface2)',
          borderRadius: 99, padding: 4, border: '1px solid var(--border)',
        }}>
          <button
            onClick={() => handleScopeChange('local')}
            style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
              background: scope === 'local' ? 'var(--accent)' : 'transparent',
              color: scope === 'local' ? '#fff' : 'var(--text-muted)',
            }}
          >
            📍 Local
          </button>
          <button
            onClick={() => handleScopeChange('global')}
            style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
              background: scope === 'global' ? 'var(--accent)' : 'transparent',
              color: scope === 'global' ? '#fff' : 'var(--text-muted)',
            }}
          >
            🌍 Global
          </button>
        </div>
      {/* ── End Local / Global Toggle ── */}

        {/* Custom Niche Dropdown */}
        <div style={{ position: 'relative' }} ref={nicheMenuRef}>
          <button
            onClick={() => setShowNicheMenu(!showNicheMenu)}
            style={{
              background: 'var(--surface2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)',
              borderRadius: 99,
              padding: '5px 14px',
              color: 'var(--text)',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.borderColor = 'var(--accent)'; 
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(109,40,217,0.15)';
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.borderColor = 'var(--border)'; 
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
            }}
          >
            <span>{niche === 'All' ? '🎯 All Niches' : niche}</span>
            <svg style={{ width: 14, height: 14, opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          <div 
            style={{
              display: showNicheMenu ? 'block' : 'none',
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              background: 'var(--surface)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '8px',
              width: 220,
              maxHeight: 300,
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
              zIndex: 100,
              animation: 'fadeInUp 0.2s ease forwards',
            }}
          >
            {NICHES.map(n => (
              <div
                key={n}
                onClick={() => {
                  handleNicheChange(n)
                  setShowNicheMenu(false)
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: niche === n ? 700 : 500,
                  color: niche === n ? '#fff' : 'var(--text)',
                  background: niche === n ? 'var(--accent)' : 'transparent',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={e => {
                  if (niche !== n) e.currentTarget.style.background = 'var(--surface2)'
                }}
                onMouseLeave={e => {
                  if (niche !== n) e.currentTarget.style.background = 'transparent'
                }}
              >
                {n === 'All' ? '🎯' : '✨'} {n === 'All' ? 'All Niches' : n}
              </div>
            ))}
          </div>
        </div>

        {/* Date chip */}
        <span style={{
          fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
          color: 'var(--text-faint)', letterSpacing: '0.06em',
        }}>{today}</span>

        {/* Source chips ,  live platforms used */}
        {!loading && trends.length > 0 && (
          [...new Set(trends.map(tr => tr.source).filter(Boolean))].map(src => {
            const meta = SOURCE_META[src] || SOURCE_META.ai
            return (
              <span key={src} style={{
                fontSize: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em',
                background: `${meta.color}18`, border: `1px solid ${meta.color}35`,
                color: meta.color, whiteSpace: 'nowrap',
              }}>{meta.label}</span>
            )
          })
        )}
        {/* Freshness stamp */}
        {ago && !loading && (
          <span style={{
            fontSize: '0.58rem', fontFamily: 'var(--font-mono)',
            color: 'var(--text-faint)', letterSpacing: '0.04em',
          }}>Updated {ago}</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Refresh button */}
        <button
          onClick={() => fetchBrief(true)}
          disabled={refreshing || loading}
          title="Refresh brief"
          style={{
            padding: '5px 11px', borderRadius: 99,
            border: `1px solid var(--border)`,
            background: 'transparent',
            color: refreshing ? C.amber : 'var(--text-faint)',
            cursor: refreshing || loading ? 'default' : 'pointer',
            fontSize: '0.8rem',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {refreshing && <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}>ANALYZING LIVE TRENDS...</span>}
          <span style={{
            display: 'inline-block',
            animation: refreshing ? 'spinOnce 0.8s linear infinite' : 'none',
            fontSize: '0.72rem',
          }}>↻</span>
        </button>

        {/* Listen button */}
        <button
          onClick={playGreeting}
          disabled={!greeting || preparing}
          style={{
            padding: '6px 14px', borderRadius: 99,
            border: `1px solid ${speaking || preparing ? C.teal : 'var(--border)'}`,
            background: speaking || preparing ? `${C.teal}14` : 'transparent',
            color: speaking || preparing ? C.teal : 'var(--text-faint)',
            cursor: greeting && !preparing ? 'pointer' : 'not-allowed',
            fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {preparing ? 'Loading...' : (speaking ? t('dash_stop') : played ? t('dash_replay') : t('dash_listen'))}
        </button>
      </div>

      {/* ── AI context line ── */}
      {!loading && greeting?.greeting && (
        <p style={{
          fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.65,
          margin: '0 0 20px',
          paddingLeft: 14,
          borderLeft: `3px solid ${isLight ? 'rgba(200,80,0,0.25)' : 'rgba(255,140,0,0.28)'}`,
          opacity: refreshing ? 0.5 : 1, transition: 'opacity 0.3s'
        }}>
          {greeting.greeting}
        </p>
      )}

      {/* ── Trend cards ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[0,1,2].map(i => (
            <div key={i} className="shimmer" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      ) : trends.length ? (
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
          opacity: refreshing ? 0.5 : 1, pointerEvents: refreshing ? 'none' : 'auto', transition: 'opacity 0.3s'
        }}>
          {trends.slice(0, 3).map((trendItem, i) => {
            const isObj = typeof trendItem === 'object'
            const trend = isObj ? trendItem : { title: trendItem }
            const FALLBACK_COLORS = [C.green, C.violet, C.pink]
            const color    = CATEGORY_COLORS[trend.category] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
            const rank     = String(i + 1).padStart(2, '0')
            const virality = VIRALITY[i] || 38
            const badge    = TREND_BADGE[i] || '📊 TRENDING'
            const srcMeta  = SOURCE_META[trend.source] || SOURCE_META.ai
            return (
              <div
                key={i}
                onClick={() => setSelectedTrend(trend)}
                style={{
                  position: 'relative',
                  padding: '18px 20px 16px',
                  borderRadius: 16,
                  height: '100%',
                  background: isLight
                    ? 'rgba(255,255,255,0.97)'
                    : 'var(--surface-card-deep)',
                  border: `1px solid ${color}28`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                  boxShadow: isLight
                    ? `0 2px 16px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.98) inset`
                    : `0 4px 28px rgba(0,0,0,0.60), 0 1px 0 rgba(255,195,90,0.14) inset`,
                  display: 'flex', flexDirection: 'column',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.borderColor = `${color}60`
                  e.currentTarget.style.boxShadow = isLight
                    ? `0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px ${color}30`
                    : `0 14px 48px rgba(0,0,0,0.70), 0 0 28px ${color}20`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = `${color}28`
                  e.currentTarget.style.boxShadow = isLight
                    ? `0 2px 16px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.98) inset`
                    : `0 4px 28px rgba(0,0,0,0.60), 0 1px 0 rgba(255,195,90,0.14) inset`
                }}
              >
                {/* Rank watermark ,  opacity on element so all hues render equally visible */}
                <span style={{
                  position: 'absolute', right: 12, top: 8,
                  fontFamily: 'var(--font-creator)', fontWeight: 900,
                  fontSize: '4rem', lineHeight: 1,
                  color,
                  opacity: isLight ? 0.14 : 0.20,
                  userSelect: 'none', pointerEvents: 'none',
                  letterSpacing: '-0.05em',
                }}>{rank}</span>

                {/* Top row: badge + category chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {/* Freshness badge */}
                  <span style={{
                    fontSize: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 800,
                    padding: '2px 7px', borderRadius: 99, letterSpacing: '0.08em',
                    background: `${color}20`, border: `1px solid ${color}40`, color,
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>{badge}</span>

                  {/* Source badge ,  where this trend came from */}
                  <span style={{
                    fontSize: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '2px 7px', borderRadius: 99, letterSpacing: '0.06em',
                    background: `${srcMeta.color}15`, border: `1px solid ${srcMeta.color}35`,
                    color: srcMeta.color, whiteSpace: 'nowrap',
                  }}>{srcMeta.label}</span>
                </div>

                {/* Title */}
                <div style={{
                  fontFamily: 'var(--font-creator)', fontWeight: 800,
                  fontSize: '0.95rem', lineHeight: 1.35,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  marginBottom: 7, flex: 1,
                }}>
                  {trend.title}
                </div>

                {/* Description (truncated) */}
                {trend.description && (
                  <div style={{
                    fontSize: '0.74rem', color: 'var(--text-faint)',
                    lineHeight: 1.5, marginBottom: 10,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {trend.description}
                  </div>
                )}

                {/* Hook preview */}
                {trend.hook && (
                  <div style={{
                    fontSize: '0.68rem', color: color,
                    fontFamily: 'var(--font-mono)', fontWeight: 600,
                    lineHeight: 1.4, marginBottom: 10,
                    padding: '6px 10px',
                    background: `${color}0C`,
                    borderRadius: 8, borderLeft: `2px solid ${color}60`,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    💡 {trend.hook}
                  </div>
                )}

                {/* Virality bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: '0.55rem', fontFamily: 'var(--font-mono)',
                      color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>Virality</span>
                    <span style={{
                      fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                      fontWeight: 700, color,
                    }}>{virality}%</span>
                  </div>
                  <div style={{
                    height: 3, borderRadius: 99,
                    background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${virality}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}88)`,
                      borderRadius: 99, transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {/* CTA */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                  fontWeight: 700, color, letterSpacing: '0.04em',
                }}>
                  Write this script →
                </div>

                {/* Bottom accent */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 2,
                  background: `linear-gradient(90deg, ${color}70, ${color}18, transparent)`,
                  borderRadius: '0 0 16px 16px',
                }} />
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', margin: 0 }}>
          Could not load today's trends.{' '}
          <button onClick={() => fetchBrief(true)} style={{
            background: 'none', border: 'none', color: C.cyan,
            cursor: 'pointer', fontSize: 'inherit', padding: 0, textDecoration: 'underline',
          }}>Retry</button>
        </p>
      )}

      {/* ── 🎵 Trending Audio Section (Spotify) ── */}
      {(audioTracks.length > 0 || audioLoading) && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{
              fontSize: '0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-faint)',
            }}>🎵 Trending Audio for Reels</span>
            <span style={{
              fontSize: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 8px', borderRadius: 99,
              background: '#1DB95415', border: '1px solid #1DB95435', color: '#1DB954',
            }}>Spotify Viral 50</span>
          </div>

          {audioLoading ? (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} className="shimmer" style={{ width: 160, height: 64, borderRadius: 12, flexShrink: 0 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {audioTracks.slice(0, 10).map((track, i) => (
                <a
                  key={i}
                  href={track.spotifyUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', flexShrink: 0 }}
                >
                  <div style={{
                    width: 168, padding: '12px 14px',
                    background: isLight ? 'rgba(255,255,255,0.97)' : 'var(--surface)',
                    border: isLight ? '1px solid rgba(29,185,84,0.18)' : '1px solid rgba(29,185,84,0.22)',
                    borderRadius: 12, cursor: 'pointer',
                    transition: 'transform 0.18s, border-color 0.18s',
                    boxShadow: isLight ? '0 2px 10px rgba(0,0,0,0.06)' : '0 4px 18px rgba(0,0,0,0.45)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(29,185,84,0.50)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = isLight ? 'rgba(29,185,84,0.18)' : 'rgba(29,185,84,0.22)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{
                        fontSize: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 800,
                        padding: '1px 5px', borderRadius: 4,
                        background: '#1DB95420', color: '#1DB954',
                      }}>#{i + 1}</span>
                      <span style={{ fontSize: '0.7rem' }}>🎵</span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-creator)', fontWeight: 700,
                      fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.3,
                      marginBottom: 3,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{track.name}</div>
                    <div style={{
                      fontSize: '0.62rem', color: 'var(--text-faint)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>{track.artist}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <TrendDetailModal 
        isOpen={!!selectedTrend} 
        trend={selectedTrend} 
        onClose={() => setSelectedTrend(null)} 
        onGenerateScript={(topicTitle) => {
          handleGenerate(topicTitle)
        }} 
      />
    </section>
  )
}

/* ─── Creator Score ───────────────────────────────────────────────── */
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
      await navigator.clipboard.writeText(`My Nuove Creator Score: ${val} ,  ${level || 'Rising Creator'} 🚀`)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div style={{
      background: isLight
        ? 'rgba(255,255,255,0.97)'
        : `linear-gradient(135deg, ${C.cyan}10 0%, var(--surface) 52%, ${C.pink}07 100%)`,
      border: isLight ? '1px solid rgba(109,40,217,0.18)' : '1px solid var(--border)',
      borderRadius: 18, padding: '22px 26px', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontFamily: 'var(--font-creator)', fontWeight: 800,
            fontSize: '3.4rem', lineHeight: 0.95, letterSpacing: '-0.04em',
            background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.pink} 55%, ${C.amber} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>{val}</div>
          <div style={{
            fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6,
          }}>{level || 'Rising Creator'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{
            fontSize: '0.7rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10,
          }}>{t('dash_score_breakdown')}</div>
          <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
            {segments.map(seg => {
              const v = breakdown[seg.key] || 0
              const pct = (v / total) * 100
              return (
                <div key={seg.key} title={`${seg.label}: ${v}`} style={{
                  flex: pct, minWidth: pct > 0 ? 4 : 0, borderRadius: 99,
                  background: seg.color, transition: 'flex 0.4s ease',
                }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {segments.map(seg => (
              <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {seg.label} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{breakdown[seg.key] ?? ', '}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={shareScore} style={{
          padding: '9px 16px', borderRadius: 10,
          border: `1px solid ${copied ? C.teal : 'var(--border)'}`,
          background: copied ? `${C.teal}14` : 'transparent',
          color: copied ? C.teal : 'var(--text-muted)',
          fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
        }}>
          {copied ? t('dash_score_copied') : t('dash_share_score')}
        </button>
      </div>
    </div>
  )
}

/* ─── Stats strip ─────────────────────────────────────────────────── */
function StatsStrip({ scripts, logs, badges, streak, isLight }) {
  const stats = [
    { value: scripts, label: 'Scripts Written', color: C.cyan,   icon: '✍️' },
    { value: logs,    label: 'Videos Analysed', color: C.teal,   icon: '📊' },
    { value: badges,  label: 'Badges Earned',   color: C.violet, icon: '🏅' },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      borderRadius: 18,
      overflow: 'hidden',
      border: isLight ? '1px solid rgba(160,70,0,0.14)' : '1px solid var(--border)',
      background: isLight ? 'rgba(255,255,255,0.97)' : 'var(--surface)',
      marginBottom: 32,
      boxShadow: isLight
        ? '0 2px 20px rgba(60,20,0,0.08), 0 1px 0 rgba(255,255,255,0.98) inset'
        : '0 4px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,195,90,0.14) inset',
    }}>
      {stats.map((s, i) => (
        <div
          key={i}
          style={{
            padding: '24px 26px 22px',
            borderRight: i < 2 ? `1px solid ${isLight ? 'rgba(160,70,0,0.10)' : 'var(--border)'}` : 'none',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Watermark number behind */}
          <span style={{
            position: 'absolute', right: 10, bottom: -6,
            fontFamily: 'var(--font-creator)', fontWeight: 900,
            fontSize: '5.5rem', lineHeight: 1, letterSpacing: '-0.06em',
            color: `${s.color}${isLight ? '0D' : '0F'}`,
            userSelect: 'none', pointerEvents: 'none',
          }}>{s.value}</span>

          {/* Label */}
          <div style={{
            fontSize: '0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            color: 'var(--text-faint)', marginBottom: 10,
          }}>{s.label}</div>

          {/* Big number */}
          <div style={{
            fontFamily: 'var(--font-creator)', fontWeight: 900,
            fontSize: '2.8rem', letterSpacing: '-0.05em', lineHeight: 1,
            color: s.color,
          }}>{s.value}</div>

          {/* Bottom accent */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${s.color}60, transparent)`,
          }} />
        </div>
      ))}
    </div>
  )
}

/* ─── Badges shelf ────────────────────────────────────────────────── */
function BadgesShelf({ badges, isLight, onOpenModal }) {
  const { t } = useLang()

  return (
    <section style={{ marginBottom: 28 }}>
      <button onClick={onOpenModal} style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        outline: 'none'
      }}>
        <span style={{
          fontSize: '0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-faint)',
        }}>{t('dash_badges')}</span>
        <span style={{
          fontSize: '0.58rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 7px', borderRadius: 99,
          background: `${C.violet}16`, border: `1px solid ${C.violet}30`,
          color: C.violet,
        }}>{badges.length}</span>
        <span style={{ fontSize: '0.6rem', color: C.violet, fontWeight: 'bold' }}>View All ➔</span>
      </button>

      {badges.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {badges.map((badge, i) => {
            const meta = BADGE_META[badge.type || badge] || { emoji: '⭐', label: badge.type || badge }
            return (
              <div key={i} title={meta.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '12px 16px',
                background: isLight
                  ? 'rgba(255,255,255,0.97)'
                  : `linear-gradient(135deg, ${C.violet}0E 0%, var(--surface) 70%)`,
                border: isLight
                  ? `1px solid rgba(179,109,255,0.20)`
                  : `1px solid ${C.violet}25`,
                borderRadius: 14, flexShrink: 0, minWidth: 76,
                boxShadow: isLight
                  ? '0 2px 12px rgba(100,40,200,0.08)'
                  : '0 4px 20px rgba(0,0,0,0.45)',
                transition: 'transform 0.18s',
                cursor: 'pointer',
              }}
                onClick={onOpenModal}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{meta.emoji}</span>
                <span style={{
                  fontSize: '0.58rem', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: '0.04em', whiteSpace: 'nowrap', fontWeight: 700,
                }}>{meta.label}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          Create scripts and stay active to earn badges!
        </div>
      )}
    </section>
  )
}

/* ─── Streak banner ───────────────────────────────────────────────── */
function StreakBanner({ streak, isLight }) {
  const { t } = useLang()
  if (!streak) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
      padding: '16px 22px',
      background: isLight
        ? 'rgba(255,255,255,0.97)'
        : `linear-gradient(135deg, ${C.amber}14 0%, var(--surface) 60%)`,
      border: isLight ? `1px solid rgba(217,119,6,0.20)` : `1px solid ${C.amber}38`,
      borderRadius: 14, marginBottom: 28,
      boxShadow: isLight
        ? '0 2px 16px rgba(180,80,0,0.08)'
        : `0 4px 28px rgba(0,0,0,0.50), 0 0 30px ${C.amber}0E`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${C.amber}18`, border: `1px solid ${C.amber}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem',
        }}>🔥</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-creator)', fontWeight: 900,
              fontSize: '1.8rem', letterSpacing: '-0.04em', color: C.amber,
            }}>{streak}</span>
            <span style={{
              fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700,
            }}>{t('dash_day_streak')}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            Keep it going ,  create something today
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Dashboard ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user }          = useAuth()
  const { t, lang }       = useLang()
  const { goals, platform } = usePrefs()
  const navigate = useNavigate()
  const [scripts, setSc]  = useState(() => JSON.parse(localStorage.getItem('dash_scripts') || '[]'))
  const [logs, setLogs]   = useState(() => JSON.parse(localStorage.getItem('dash_logs') || '[]'))
  const [badges, setBadges] = useState(() => JSON.parse(localStorage.getItem('dash_badges') || '[]'))
  const [profile, setProfile] = useState(() => JSON.parse(localStorage.getItem('dash_profile') || 'null'))
  const [creatorScore, setCreatorScore] = useState(null)
  const [loading, setLd]  = useState(!localStorage.getItem('dash_profile'))
  const [showBadgeModal, setShowBadgeModal] = useState(false)

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
        
        try {
          localStorage.setItem('dash_scripts', JSON.stringify(s.scripts || []))
          localStorage.setItem('dash_logs', JSON.stringify(p.logs || []))
          localStorage.setItem('dash_badges', JSON.stringify(b.badges || []))
          if (prof) localStorage.setItem('dash_profile', JSON.stringify(prof))
        } catch {}

        if (prof?.platform) {
          try {
            const stored = JSON.parse(localStorage.getItem('vs_prefs') || '{}')
            localStorage.setItem('vs_prefs', JSON.stringify({
              platform: prof.platform || stored.platform || null,
              goals:    prof.goals    || stored.goals    || [],
            }))
          } catch {}
        }
      })
      .finally(() => setLd(false))
  }, [])

  const { theme } = useTheme()
  const isLight  = theme === 'light'
  const limit    = { FREE: 10, STARTER: 50, PRO: '∞' }[user?.plan] || 10

  const used     = user?.generationsUsed || 0
  const streak   = profile?.user?.streak ?? profile?.streak ?? 0
  const firstName = user?.name?.split(' ')[0] || 'Creator'
  const mood = getTimeMood()

  return (
    <div className="page-enter" style={{ position: 'relative' }}>

      {/* ─── Greeting ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', borderRadius: 99,
          background: `${mood.color}12`,
          border: `1px solid ${mood.color}35`,
          marginRight: 18,
          verticalAlign: 'middle',
        }}>
          <span style={{ fontSize: '0.88rem' }}>{mood.emoji}</span>
          <span style={{
            fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: mood.color, textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>{mood.label}</span>
        </div>

        <h1 className="page-title" style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: 0, marginBottom: 8 }}>
          {t('dash_greeting_' + mood.key)}, {firstName}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          {t('dash_overview')}
        </p>
      </div>

      {/* ─── Stats strip ──────────────────────────────────────────── */}
      <StatsStrip
        scripts={scripts.length}
        logs={logs.length}
        badges={badges.length}
        streak={streak}
        isLight={isLight}
      />

      {/* ─── Streak ───────────────────────────────────────────────── */}
      <StreakBanner streak={streak} isLight={isLight} />

      {/* ─── Trending brief ───────────────────────────────────────── */}
      <TrendingBrief userName={firstName} />

      {/* ─── Badges shelf ─────────────────────────────────────────── */}
      <BadgesShelf badges={badges} isLight={isLight} onOpenModal={() => setShowBadgeModal(true)} />

      {/* ─── Badge Progress Modal ─────────────────────────────────── */}
      {showBadgeModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: 20
        }} onClick={() => setShowBadgeModal(false)}>
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24,
              width: '100%', maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Your Badges</h2>
              <button onClick={() => setShowBadgeModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(BADGE_META).map(([key, meta]) => {
                const isEarned = badges.some(b => (b.type || b) === key);
                // Real progress calculation would go here if we passed down total scripts/streaks/logs
                // but showing locked/unlocked meets the goal of seeing what needs to be achieved!
                
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                    background: isEarned ? `${C.violet}15` : 'var(--surface2)',
                    border: `1px solid ${isEarned ? C.violet + '40' : 'var(--border)'}`,
                    borderRadius: 16, opacity: isEarned ? 1 : 0.6
                  }}>
                    <div style={{ fontSize: '2.4rem', filter: isEarned ? 'none' : 'grayscale(100%)' }}>{meta.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: isEarned ? C.violet : 'var(--text)', marginBottom: 4 }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {meta.desc}
                      </div>
                    </div>
                    {isEarned ? (
                      <div style={{ color: C.violet, fontWeight: 'bold', fontSize: '1.4rem', filter: 'drop-shadow(0 0 8px rgba(179,109,255,0.4))' }}>✓</div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locked</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Upgrade banner ───────────────────────────────────────── */}
      {user?.plan === 'FREE' && (
        <div style={{
          marginTop: 8,
          padding: '22px 26px',
          borderRadius: 18,
          background: isLight
            ? 'rgba(255,255,255,0.97)'
            : `linear-gradient(135deg, ${C.cyan}10 0%, var(--surface) 45%, ${C.pink}09 100%)`,
          border: isLight ? `1px solid rgba(200,80,0,0.16)` : `1px solid ${C.pink}35`,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          boxShadow: isLight
            ? '0 2px 20px rgba(80,30,0,0.09)'
            : `0 4px 32px rgba(0,0,0,0.55)`,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-creator)', fontWeight: 800,
              fontSize: '1.1rem', letterSpacing: '-0.02em', marginBottom: 5,
              background: `linear-gradient(135deg, ${C.cyan}, ${C.pink} 60%, ${C.amber})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{t('dash_unlock_title')}</div>
            <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              <span style={{ color: C.pink, fontWeight: 700 }}>{used}/{limit}</span>{' '}
              {t('generate_usage')} · {t('dash_free_desc')}
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
