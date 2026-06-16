import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useToast } from '../components/Toast'
import { getSavedRegion } from '../utils/detectRegion'

// ─── Frontend topic cache ──────────────────────────────────────────
// Keyed by "lang". Stored in localStorage with a 30-min TTL.
// Returns topics instantly on repeat visits; refreshes silently in bg.
const CACHE_TTL_MS = 30 * 60 * 1000  // 30 minutes

// Cache key includes scope so local/global results are stored separately
function cacheKey(lang, scope) { return `vc_trending_${lang}_${scope}` }

function readCache(lang, scope) {
  try {
    const raw = localStorage.getItem(cacheKey(lang, scope))
    if (!raw) return null
    const { topics, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return topics
  } catch { return null }
}

function writeCache(lang, scope, topics) {
  try {
    localStorage.setItem(cacheKey(lang, scope), JSON.stringify({ topics, ts: Date.now() }))
  } catch {}
}

// Skeleton card
function SkeletonCard() {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ height: 14, width: '80%', background: 'var(--surface3)', borderRadius: 6, animation: 'pulse 1.5s ease infinite' }} />
      <div style={{ height: 12, width: '60%', background: 'var(--surface3)', borderRadius: 6, animation: 'pulse 1.5s ease infinite' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ height: 32, flex: 1, background: 'var(--surface3)', borderRadius: 8, animation: 'pulse 1.5s ease infinite' }} />
        <div style={{ height: 32, width: 36, background: 'var(--surface3)', borderRadius: 8, animation: 'pulse 1.5s ease infinite' }} />
      </div>
    </div>
  )
}

export default function Trending() {
  const { lang, t }  = useLang()
  const navigate     = useNavigate()
  const toast        = useToast()

  const [topics,     setTopics]     = useState(() => readCache(lang, 'local') || [])
  const [loading,    setLoading]    = useState(() => !readCache(lang, 'local'))
  const [refreshing, setRefreshing] = useState(false)
  const [saved,      setSaved]      = useState(new Set())
  const [saving,     setSaving]     = useState(null)
  const abortRef = useRef(null)

  // ── Local / Global scope toggle
  const [scope, setScope] = useState('local')  // 'local' | 'global'
  const scopeRef          = useRef('local')     // always-fresh for fetchTopics closure

  const fetchTopics = useCallback(async ({ silent = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    if (silent) setRefreshing(true)
    else        setLoading(true)

    const region = scopeRef.current === 'global' ? 'Global' : (getSavedRegion() || 'India')
    const niche  = scopeRef.current === 'global' ? 'global' : undefined
    const currentScope = scopeRef.current

    try {
      const data = await api.getTrending(lang, region, false, niche)
      const fresh = data.topics || []
      setTopics(fresh)
      writeCache(lang, currentScope, fresh)
    } catch (err) {
      if (err?.name === 'AbortError') return
      if (!silent) {
        setTopics([])
        toast('Could not load trending topics', 'error')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lang])

  const handleScopeChange = (newScope) => {
    if (newScope === scopeRef.current) return
    scopeRef.current = newScope
    setScope(newScope)
    setSaved(new Set())
    const cached = readCache(lang, newScope)
    if (cached) {
      setTopics(cached)
      setLoading(false)
      fetchTopics({ silent: true })
    } else {
      setTopics([])
      setLoading(true)
      fetchTopics()
    }
  }

  useEffect(() => {
    const cached = readCache(lang, scopeRef.current)
    if (cached) {
      setTopics(cached)
      setLoading(false)
      fetchTopics({ silent: true })
    } else {
      setTopics([])
      setLoading(true)
      fetchTopics()
    }
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = (topic) => {
    localStorage.setItem('arc_prefill_topic', topic)
    navigate('/generate', { state: { topic } })
  }

  const handleBookmark = async (topic, idx) => {
    setSaving(idx)
    try {
      await api.createTemplate({
        name: topic.slice(0, 80),
        type: 'hook',
        content: topic,
        source: 'trending'
      })
      setSaved(s => new Set([...s, idx]))
      toast('Saved as template!', 'success')
    } catch (err) {
      toast(err.message || 'Could not save template', 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">{t('trending_title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p className="page-sub" style={{ margin: 0 }}>Discover what's viral and turn it into a script instantly.</p>
        </div>
      </div>

      {/* Refresh + Scope toggle row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* ── Local / Global pill toggle ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--surface2)', borderRadius: 99, padding: 3,
          border: '1px solid var(--border)', gap: 2,
        }}>
          <button
            onClick={() => handleScopeChange('local')}
            title="Trending in your region"
            style={{
              padding: '6px 16px', borderRadius: 99, border: 'none',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              background: scope === 'local' ? 'var(--surface-card)' : 'transparent',
              color: scope === 'local' ? 'var(--accent)' : 'var(--text-faint)',
              boxShadow: scope === 'local' ? '0 1px 4px rgba(0,0,0,0.20)' : 'none',
              transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            📍 Local
          </button>
          <button
            onClick={() => handleScopeChange('global')}
            title="Trending around the world"
            style={{
              padding: '6px 16px', borderRadius: 99, border: 'none',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              background: scope === 'global' ? 'linear-gradient(90deg, #6366f1, #8b5cf6)' : 'transparent',
              color: scope === 'global' ? '#fff' : 'var(--text-faint)',
              boxShadow: scope === 'global' ? '0 2px 12px rgba(99,102,241,0.45)' : 'none',
              transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            🌍 Global
          </button>
        </div>

        {/* Right: updating + Refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {refreshing && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              updating…
            </span>
          )}
          <button
            onClick={() => fetchTopics()}
            disabled={loading || refreshing}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: (loading || refreshing) ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M23 4v6h-6"/>
              <path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Topics grid */}
      <div style={tStyles.grid}>
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : topics.length === 0
            ? (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 24px' }}>
                <div className="empty-state">
                  <div className="icon">📡</div>
                  <p style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                    No trending topics found
                  </p>
                  <p>Try refreshing.</p>
                  <button onClick={fetchTopics} className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                    Try Again
                  </button>
                </div>
              </div>
            )
            : topics.map((topic, i) => {
              const topicText = typeof topic === 'string' ? topic : topic.text || topic.title || JSON.stringify(topic)
              const isSaved   = saved.has(i)
              return (
                <div key={i} className="card card-sm" style={tStyles.topicCard}>
                  <div style={tStyles.topicRank}>#{i + 1}</div>
                  <div style={tStyles.topicText}>{topicText}</div>
                  <div style={tStyles.cardActions}>
                    <button
                      onClick={() => handleGenerate(topicText)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Generate Script →
                    </button>
                    <button
                      onClick={() => handleBookmark(topicText, i)}
                      disabled={isSaved || saving === i}
                      title={isSaved ? 'Saved' : 'Save as template'}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: isSaved ? '1px solid var(--teal)' : '1px solid var(--border)',
                        background: isSaved ? 'var(--teal-dim)' : 'var(--surface2)',
                        color: isSaved ? 'var(--teal)' : 'var(--text-muted)',
                        cursor: isSaved ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                      }}
                    >
                      {isSaved ? '✓' : saving === i ? '…' : '🔖'}
                    </button>
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}

const tStyles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  topicCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    transition: 'border-color 0.15s, transform 0.15s',
  },
  topicRank: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    color: 'var(--text-faint)',
    letterSpacing: '0.06em',
  },
  topicText: {
    fontSize: '0.9rem',
    lineHeight: 1.5,
    fontWeight: 500,
    flex: 1,
    color: 'var(--text)',
  },
  cardActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
}
