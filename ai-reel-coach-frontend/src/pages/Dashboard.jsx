import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useTextToSpeech } from '../components/VoiceAssistant'
import { usePrefs } from '../hooks/usePrefs'
import { getSavedRegion, saveRegion, REGIONS } from '../utils/detectRegion'
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

function timeAgo(ts) {
  if (!ts) return null
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1)  return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  return `${h}h ago`
}

/* ─── Today's Brief ,  editorial redesign ─────────────────────────── */
function TrendingBrief({ userName }) {
  const { t, lang } = useLang()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const handleGenerate = (topic) => {
    localStorage.setItem('arc_prefill_topic', topic)
    navigate('/generate', { state: { topic } })
  }

  const isLight = theme === 'light'
  const { speaking, preparing, speak, stopSpeaking, prefetch } = useTextToSpeech()
  const [played, setPlayed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [scope, setScope] = useState('local')
  const scopeRef = useRef('local')

  const [region, setRegion] = useState(() => { const s = getSavedRegion(); return (s && s !== 'Global') ? s : 'India' })
  const [showRegionMenu, setShowRegionMenu] = useState(false)
  const regionMenuRef = useRef(null)

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
      if (regionMenuRef.current && !regionMenuRef.current.contains(event.target)) {
        setShowRegionMenu(false)
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
    google:    { label: '🔍 Google Trends' },
    youtube:   { label: '📺 YouTube' },
    twitter:   { label: '𝕏 Trending' },
    instagram: { label: '📸 Instagram' },
    spotify:   { label: '🎵 Spotify' },
    news:      { label: '📰 News' },
  }

  const fetchBrief = useCallback((force = false) => {
    // The region is always a real country — never 'Global' (the scope toggle
    // handles worldwide). A 'Global' or empty saved value falls back to India.
    const saved = getSavedRegion()
    const region = (saved && saved !== 'Global') ? saved : 'India'
    const rawNiche = nicheRef.current
    const activeNiche = rawNiche === 'All' ? 'general' : rawNiche
    const currentScope = scopeRef.current

    const ts = Date.now()
    const today = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
    const bust = `&_t=${ts}&date=${today}`
    const cacheKey = `brief_${region}_${currentScope}_${activeNiche}_${lang}`

    const isCurrent = () => scopeRef.current === currentScope && nicheRef.current === rawNiche
    const writeCache = (patch) => {
      try {
        const prev = JSON.parse(localStorage.getItem(cacheKey) || 'null') || {}
        localStorage.setItem(cacheKey, JSON.stringify({ ...prev, ...patch, date: today }))
      } catch {}
    }

    // ── Instant paint from cache so repeat visits feel immediate ──
    let hadCache = false
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
        if (cached && cached.date === today && cached.trends?.length) {
          setGreeting(cached.greeting || null)
          setTrends(cached.trends)
          setTrendFetchedAt(cached.fetchedAt || null)
          setLoading(false)
          hadCache = true
        }
      } catch {}
    }

    if (force) setRefreshing(true)
    else if (!hadCache) setLoading(true)

    const greetingPromise = api.getGreeting(region, lang, bust, activeNiche, currentScope).catch(() => null)
    const trendingPromise = api.getTrending(lang, region, force, activeNiche, currentScope).catch(() => null)

    // ── Trends: render the moment they arrive — don't wait on the AI greeting ──
    trendingPromise.then(trendData => {
      if (!isCurrent()) return
      const liveTrends = trendData?.topics?.length
        ? trendData.topics
        : (trendData?.trends?.length ? trendData.trends : null)
      if (liveTrends && liveTrends.length > 0) {
        const fetchedAt = trendData?.fetchedAt || Date.now()
        setTrends(liveTrends)
        setTrendFetchedAt(fetchedAt)
        writeCache({ trends: liveTrends, fetchedAt })
      } else if (!hadCache) {
        setTrends([])
      }
      setLoading(false)
      setRefreshing(false)
    })

    // ── Greeting: fills in independently; can backfill trends if needed ──
    greetingPromise.then(greetData => {
      if (!isCurrent() || !greetData) return
      setGreeting(greetData)
      writeCache({ greeting: greetData })
      if (greetData.trends?.length) {
        setTrends(prev => (prev && prev.length ? prev : greetData.trends))
      }
    }).finally(() => {
      // Safety net: never leave the spinner stuck if trends errored out
      if (isCurrent()) { setLoading(false); setRefreshing(false) }
    })
  }, [lang])

  const fetchAudio = useCallback(() => {
    const saved = getSavedRegion()
    const region = (saved && saved !== 'Global') ? saved : 'India'
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

  // Region picker — pick a country (Local for that country) or Global.
  const handleRegionChange = (value) => {
    setShowRegionMenu(false)
    const goGlobal = value === 'Global'
    if (!goGlobal) { saveRegion(value); setRegion(value) }
    scopeRef.current = goGlobal ? 'global' : 'local'
    setScope(scopeRef.current)
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

  const playGreeting = () => {
    const text = getGreetingText()
    if (!text) return
    if (speaking || preparing) { stopSpeaking(); return }
    speak(text)
    setPlayed(true)
  }

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const ago   = timeAgo(trendFetchedAt)

  // Show a fresh random 3 of the (real, cached) trends on each page load — gives
  // variety every refresh without re-hitting the live APIs on every visit. The
  // pick is stable within a mount (no jumping) and changes on reload.
  const [pickSeed] = useState(() => Math.floor(Math.random() * 100000) + 1)
  const displayTrends = useMemo(() => {
    const arr = Array.isArray(trends) ? trends : []
    if (arr.length <= 3) return arr
    // Rotate only among the top (most relevant/local) trends, so refreshes stay
    // varied without surfacing lower-ranked, globally-viral items.
    const pool = arr.slice(0, 6)
    return pool
      .map((tr, i) => ({ tr, k: ((i + 1) * pickSeed) % 9973 }))
      .sort((a, b) => a.k - b.k)
      .slice(0, 3)
      .map(x => x.tr)
  }, [trends, pickSeed])

  return (
    <section style={{ marginBottom: 32 }}>

      {/* ── Section header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 10
      }}>
        <h2 style={{
          margin: 0, fontSize: '1.6rem',
          fontFamily: '"Dancing Script", cursive', fontWeight: 700,
          letterSpacing: '0.01em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #00D4FF 0%, #FF2D8B 50%, #FFB800 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {t('dash_todays_brief')}
        </h2>

        {/* Controls — toggle, niche, refresh & listen all on the same level */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        {/* Region + scope picker — shows the current country, click to change */}
        <div style={{ position: 'relative' }} ref={regionMenuRef}>
          <button
            onClick={() => setShowRegionMenu(v => !v)}
            title="Choose your region"
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 99, padding: '5px 12px', color: 'var(--text)',
              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{scope === 'global'
              ? (REGIONS.find(r => r.value === 'Global')?.label || 'Global')
              : (REGIONS.find(r => r.value === region)?.label || region)}</span>
            <svg style={{ width: 13, height: 13, opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div style={{
            display: showRegionMenu ? 'block' : 'none',
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            background: 'var(--surface)', backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)', borderRadius: 16, padding: 8,
            width: 210, maxHeight: 320, overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 100,
          }}>
            {REGIONS.map(r => {
              const isActive = r.value === 'Global' ? scope === 'global' : (scope === 'local' && r.value === region)
              return (
                <div
                  key={r.value}
                  onClick={() => handleRegionChange(r.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#fff' : 'var(--text)',
                    background: isActive ? 'var(--accent)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {r.label}
                </div>
              )
            })}
          </div>
        </div>

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

        </div>
      </div>

      {/* ── Trend cards ── */}
      {loading ? (
        <div className="brief-trend-grid">
          {[0,1,2].map(i => (
            <div key={i} className="shimmer" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      ) : trends.length ? (
        <div className="brief-trend-grid" style={{
          opacity: refreshing ? 0.5 : 1, pointerEvents: refreshing ? 'none' : 'auto', transition: 'opacity 0.3s'
        }}>
          {displayTrends.map((trendItem, i) => {
            const isObj = typeof trendItem === 'object'
            const trend = isObj ? trendItem : { title: trendItem }
            const rank    = String(i + 1).padStart(2, '0')
            const srcMeta = trend.source && trend.source !== 'ai'
              ? (SOURCE_META[trend.source] || { label: trend.source })
              : null
            return (
              <div
                key={i}
                onClick={() => setSelectedTrend(trend)}
                style={{
                  padding: '16px 18px',
                  borderRadius: 16,
                  height: '100%',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'border-color 0.18s ease, transform 0.18s ease',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform   = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = C.amber
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform   = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {/* Rank + source */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-creator)', fontWeight: 800,
                    fontSize: '0.95rem', color: C.amber, letterSpacing: '-0.02em',
                  }}>{rank}</span>
                  {srcMeta && (
                    <span style={{
                      fontSize: '0.58rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: 'var(--text-faint)', whiteSpace: 'nowrap',
                    }}>{srcMeta.label}</span>
                  )}
                </div>

                {/* Title */}
                <div style={{
                  fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.35,
                  letterSpacing: '-0.01em', color: 'var(--text)', flex: 1,
                }}>
                  {trend.title}
                </div>

                {/* Description (truncated) */}
                {trend.description && (
                  <div style={{
                    fontSize: '0.74rem', color: 'var(--text-faint)', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {trend.description}
                  </div>
                )}

                {/* CTA */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, marginTop: 2,
                  fontSize: '0.72rem', fontWeight: 700, color: C.amber,
                }}>
                  Write this script →
                </div>
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

/* ─── Quick action launchers ─────────────────────────────────────── */
const QA_ICON = {
  generate: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  record:   <><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
  captions: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="10" x2="13" y2="10" /><line x1="6" y1="14" x2="17" y2="14" /></>,
  advisor:  <><path d="M9 18h6M10 22h4" /><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5" /></>,
}
function QaIcon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {QA_ICON[name]}
    </svg>
  )
}

function QuickActions() {
  const { t } = useLang()
  const actions = [
    { to: '/generate', icon: 'generate', title: t('nav_generate'), sub: 'New script'      },
    { to: '/record',   icon: 'record',   title: t('nav_record'),   sub: 'Teleprompter'    },
    { to: '/captions', icon: 'captions', title: t('nav_captions'), sub: 'Captions & tags' },
    { to: '/coach',    icon: 'advisor',  title: t('nav_coach'),    sub: 'Get advice'      },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 30 }}>
      {actions.map(a => (
        <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 12,
              padding: '18px 16px', borderRadius: 16, height: '100%',
              background: 'var(--surface-card)',
              border: '1px solid var(--border)',
              transition: 'border-color 0.18s ease, transform 0.18s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.amber
              e.currentTarget.style.transform   = 'translateY(-2px)'
              const ic = e.currentTarget.querySelector('.qa-ic'); if (ic) ic.style.color = C.amber
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.transform   = 'translateY(0)'
              const ic = e.currentTarget.querySelector('.qa-ic'); if (ic) ic.style.color = 'var(--text-muted)'
            }}
          >
            <span className="qa-ic" style={{ color: 'var(--text-muted)', transition: 'color 0.18s ease', display: 'flex' }}>
              <QaIcon name={a.icon} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 2, letterSpacing: '-0.01em' }}>{a.title}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{a.sub}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

/* ─── Progress strip (streak + badges) ───────────────────────────── */
function ProgressStrip({ streak, badgeCount, onOpenBadges }) {
  const { t } = useLang()
  const tileStyle = (clickable) => ({
    flex: 1, display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', borderRadius: 14,
    background: 'var(--surface-card)', border: '1px solid var(--border)',
    cursor: clickable ? 'pointer' : 'default',
  })
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
      <div style={tileStyle(false)}>
        <span style={{ color: C.amber, display: 'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s4 3.5 4 8a4 4 0 0 1-8 0c0-1.3.4-2.4 1-3.3.5 1 1.2 1.6 2 1.6 0-2.2-1-4.3 1-6.3Z" /></svg>
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-creator)', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', lineHeight: 1 }}>{streak || 0}</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-faint)', marginTop: 3 }}>{t('dash_day_streak')}</div>
        </div>
      </div>
      <div style={tileStyle(true)} onClick={onOpenBadges}>
        <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="5" /><path d="M8.5 13 7 22l5-3 5 3-1.5-9" /></svg>
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-creator)', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', lineHeight: 1 }}>{badgeCount}</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-faint)', marginTop: 3 }}>{t('dash_badges')}</div>
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '0.7rem', fontWeight: 600 }}>View →</span>
      </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '4px 12px', borderRadius: 99,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: '0.82rem' }}>{mood.emoji}</span>
            <span style={{
              fontSize: '0.64rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>{mood.label}</span>
          </div>

          <h1 className="page-title" style={{ margin: 0, minWidth: 0 }}>
            {t('dash_greeting_' + mood.key)}, {firstName}
          </h1>
        </div>
      </div>

      {/* ─── Quick actions ────────────────────────────────────────── */}
      <QuickActions />

      {/* ─── Trending today ───────────────────────────────────────── */}
      <TrendingBrief userName={firstName} />

      {/* ─── Progress: streak + badges ────────────────────────────── */}
      <ProgressStrip streak={streak} badgeCount={badges.length} onOpenBadges={() => setShowBadgeModal(true)} />

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
