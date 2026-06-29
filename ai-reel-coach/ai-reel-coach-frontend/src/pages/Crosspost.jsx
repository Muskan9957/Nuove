import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { usePersistentState } from '../hooks/usePersistentState'

/* ─── Creator palette (matches Dashboard) ────────────────────────── */
const C = {
  cyan:   '#00D4FF',
  pink:   '#FF2D8B',
  lime:   '#A8FF3C',
  amber:  '#FFB800',
  coral:  '#FF5F4C',
  violet: '#A855F7',
  teal:   '#00D4B1',
}

const PLATFORMS = [
  { key: 'twitter',  label: 'Twitter / X',       icon: '𝕏',   color: C.cyan   },
  { key: 'linkedin', label: 'LinkedIn',           icon: 'in',  color: C.violet },
  { key: 'youtube',  label: 'YouTube Shorts',     icon: '▶',   color: C.coral  },
  { key: 'caption',  label: 'Instagram Caption',  icon: '◈',   color: C.pink   },
]

function PulsingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />
      ))}
    </span>
  )
}

/* heuristic split: first line = hook, last line = CTA, middle = body */
function autoSplit(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return { hook: '', body: '', cta: '' }
  if (lines.length === 1) return { hook: lines[0], body: '', cta: '' }
  if (lines.length === 2) return { hook: lines[0], body: '', cta: lines[1] }
  return {
    hook: lines[0],
    body: lines.slice(1, -1).join('\n'),
    cta:  lines[lines.length - 1],
  }
}

export default function Crosspost() {
  const { t, lang } = useLang()

  // Source: 'library' | 'paste'
  const [source, setSource]     = usePersistentState('arc_cross_source', 'library')
  const [scripts, setScripts]   = useState([])
  const [scriptsLoading, setScriptsLoading] = useState(true)
  const [pickedId, setPickedId] = usePersistentState('arc_cross_pickedId', null)
  const [pickedDetail, setPickedDetail] = usePersistentState('arc_cross_pickedDetail', null) // {hook, body, cta, topic}
  const [pickLoading, setPickLoading] = useState(false)
  const [pasted, setPasted]     = usePersistentState('arc_cross_pasted', '')

  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = usePersistentState('arc_cross_result', null)
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState({})

  const resultsRef = useRef(null)

  /* Load scripts library on mount */
  useEffect(() => {
    api.getScripts()
      .then(d => setScripts(d.scripts || []))
      .catch(() => setScripts([]))
      .finally(() => setScriptsLoading(false))
  }, [])

  /* If user has no scripts, default to paste mode */
  useEffect(() => {
    if (!scriptsLoading && scripts.length === 0) {
      setSource('paste')
    }
  }, [scriptsLoading, scripts.length])

  /* Scroll to results */
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  /* Fetch full script when picked */
  const pickScript = async (id) => {
    if (pickedId === id) {
      setPickedId(null); setPickedDetail(null); return
    }
    setPickedId(id); setPickedDetail(null); setPickLoading(true)
    try {
      const d = await api.getScript(id)
      setPickedDetail({
        hook:  d.script?.hook  || '',
        body:  d.script?.body  || '',
        cta:   d.script?.cta   || '',
        topic: d.script?.topic || '',
      })
    } catch (err) {
      setError('Could not load script details')
      setPickedId(null)
    } finally {
      setPickLoading(false)
    }
  }

  const canMultiply = (() => {
    if (loading) return false
    if (source === 'library') return !!pickedDetail && !!(pickedDetail.hook || pickedDetail.body)
    return !!pasted.trim()
  })()

  const handleMultiply = async (e) => {
    e?.preventDefault()
    if (!canMultiply) return
    setLoading(true); setError(''); setResult(null)

    let payload
    if (source === 'library' && pickedDetail) {
      payload = {
        hook:  pickedDetail.hook,
        body:  pickedDetail.body,
        cta:   pickedDetail.cta,
        topic: pickedDetail.topic || '',
        language: lang,
      }
    } else {
      const split = autoSplit(pasted)
      payload = { ...split, topic: '', language: lang }
    }

    try {
      const data = await api.remixContent(payload)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const copyPlatform = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
    } catch {}
  }

  /* ─── Render ──────────────────────────────────────────────────── */
  return (
    <div className="page-enter" style={{ maxWidth: 820 }}>

      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 99,
          background: `${C.pink}14`, border: `1px solid ${C.pink}40`,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: '0.85rem', color: C.pink }}>⇄</span>
          <span style={{
            fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: C.pink, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {t('crosspost_pill')}
          </span>
        </div>
        <h1 className="page-title">
          {t('crosspost_title_pre')} {t('crosspost_title_post')}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>
            {t('crosspost_sub')}
          </p>
          {result && (
            <button type="button" onClick={() => {
              setResult(null)
              setPasted('')
              setPickedId(null)
              setPickedDetail(null)
            }} className="btn btn-ghost btn-sm">
              New Remix
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleMultiply}>

        {/* Source toggle */}
        <div style={{
          display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          marginBottom: 18,
        }}>
          {[
            { key: 'library', label: t('crosspost_src_library') },
            { key: 'paste',   label: t('crosspost_src_paste') },
          ].map(s => {
            const active = source === s.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSource(s.key)}
                style={{
                  padding: '8px 16px', borderRadius: 9, border: 'none',
                  background: active ? `${C.pink}1F` : 'transparent',
                  color: active ? C.pink : 'var(--text-muted)',
                  fontSize: '0.84rem', fontWeight: 700,
                  fontFamily: 'var(--font-body)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* LIBRARY MODE */}
        {source === 'library' && (
          <div style={{ marginBottom: 22 }}>
            {scriptsLoading ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '20px 0' }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>{t('crosspost_loading_lib')}</span>
              </div>
            ) : scripts.length === 0 ? (
              <div style={{
                padding: '24px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  {t('crosspost_lib_empty')}
                </div>
                <Link to="/generate" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  {t('crosspost_lib_empty_cta')}
                </Link>
              </div>
            ) : (
              <div style={{
                display: 'grid', gap: 8,
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                maxHeight: 320, overflowY: 'auto', paddingRight: 4,
              }}>
                {scripts.slice(0, 24).map(s => {
                  const active = pickedId === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickScript(s.id)}
                      style={{
                        textAlign: 'left', padding: '12px 14px',
                        background: active ? `${C.pink}10` : 'var(--surface)',
                        border: `1px solid ${active ? C.pink + '66' : 'var(--border)'}`,
                        borderRadius: 11, cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 4,
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${C.pink}33` }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.topic || 'Untitled'}
                        </span>
                        {active && (
                          <span style={{ color: C.pink, fontSize: '0.9rem', flexShrink: 0 }}>✓</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                        color: 'var(--text-faint)', letterSpacing: '0.04em',
                      }}>
                        {s.language || ''} {s.platform ? `· ${s.platform}` : ''} {s.createdAt ? '· ' + new Date(s.createdAt).toLocaleDateString() : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Picked-script preview */}
            {pickLoading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
                <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>{t('crosspost_loading_script')}</span>
              </div>
            )}
            {pickedDetail && !pickLoading && (
              <div style={{
                marginTop: 14, padding: '14px 16px',
                background: 'var(--surface2)', border: `1px solid ${C.pink}33`,
                borderLeft: `3px solid ${C.pink}`, borderRadius: 11,
              }}>
                <div style={{
                  fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: C.pink, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  {t('crosspost_preview_label')}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.55, fontWeight: 600, marginBottom: 4 }}>
                  {pickedDetail.hook}
                </div>
                {pickedDetail.body && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {pickedDetail.body.length > 180 ? pickedDetail.body.slice(0, 180) + '…' : pickedDetail.body}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PASTE MODE */}
        {source === 'paste' && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {t('crosspost_paste_label')}
              </label>
              <span style={{
                fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                color: pasted.length > 1800 ? C.coral : 'var(--text-faint)',
              }}>
                {pasted.length}/2000
              </span>
            </div>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 160, resize: 'vertical', fontFamily: 'var(--font-body)' }}
              placeholder={t('crosspost_paste_ph')}
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              maxLength={2000}
            />
            <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', marginTop: 6, fontStyle: 'italic' }}>
              {t('crosspost_paste_hint')}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            color: C.coral, fontSize: '0.85rem', marginBottom: 16,
            padding: '10px 14px', background: `${C.coral}14`,
            borderRadius: 10, border: `1px solid ${C.coral}33`,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={!canMultiply}
          style={{ minWidth: 220, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {loading ? (<>{t('crosspost_running')}<PulsingDots /></>) : (<>⇄ {t('crosspost_btn')}</>)}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div ref={resultsRef} style={{ marginTop: 44 }}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{
              fontFamily: 'var(--font-creator)', fontWeight: 800,
              fontSize: '1.2rem', letterSpacing: '-0.025em', margin: 0, marginBottom: 4,
            }}>
              {t('crosspost_result_title')}
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
              {t('crosspost_result_sub')}
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 14,
          }}>
            {PLATFORMS.map(({ key, label, icon, color }) => {
              const text = result[key]
              if (!text) return null
              return (
                <div
                  key={key}
                  style={{
                    padding: 18,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderTop: `3px solid ${color}`,
                    borderRadius: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: `${color}1A`, border: `1px solid ${color}33`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: key === 'linkedin' ? '0.7rem' : '0.9rem',
                      color, fontWeight: 700, flexShrink: 0,
                    }}>
                      {icon}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-head)', fontWeight: 700,
                      fontSize: '0.9rem', color: 'var(--text)',
                    }}>
                      {label}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => copyPlatform(text, key)}
                      style={{
                        padding: '5px 12px', borderRadius: 8,
                        border: `1px solid ${copied[key] ? C.teal : 'var(--border)'}`,
                        background: copied[key] ? `${C.teal}14` : 'transparent',
                        color: copied[key] ? C.teal : 'var(--text-muted)',
                        fontSize: '0.74rem', fontFamily: 'var(--font-mono)',
                        fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {copied[key] ? t('crosspost_copied') : t('crosspost_copy')}
                    </button>
                  </div>
                  <p style={{
                    fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text)',
                    margin: 0, whiteSpace: 'pre-wrap',
                  }}>
                    {text}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
