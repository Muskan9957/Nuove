import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n.jsx'

const gradeColor = s => s >= 75 ? '#00C9A7' : s >= 50 ? '#FFD60A' : '#FF6B6B'
const gradeLabel = s => s >= 90 ? 'Excellent' : s >= 75 ? 'Good' : s >= 60 ? 'Average' : s >= 50 ? 'Weak' : 'Poor'

export default function Scripts() {
  const toast                   = useToast()
  const { t }                   = useLang()
  const navigate                = useNavigate()
  const [scripts, setScripts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch]     = useState('')
  const [detail, setDetail]     = useState({})
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    api.getScripts()
      .then(d => setScripts(d.scripts || []))
      .catch(() => toast('Could not load scripts', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (detail[id]) return
    setLoadingId(id)
    try {
      const d = await api.getScript(id)
      setDetail(prev => ({ ...prev, [id]: d.script }))
    } catch {
      toast('Could not load script details', 'error')
    } finally {
      setLoadingId(null)
    }
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast('Copied!', 'success')
  }

  const filtered = scripts.filter(s =>
    s.topic.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('scripts_title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loading ? t('loading') : `${scripts.length} ${scripts.length !== 1 ? t('scripts_count_many') : t('scripts_count_one')}`}
          </p>
        </div>
        <Link to="/generate" className="btn btn-primary btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>
          {t('scripts_new')}
        </Link>
      </div>

      {/* Search */}
      {scripts.length > 4 && (
        <div style={{ marginBottom: 20 }}>
          <input
            className="input"
            placeholder={t('scripts_search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 68, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          {search ? (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{t('scripts_no_match')} "{search}"</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>{t('scripts_clear')}</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✍️</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.95rem' }}>{t('scripts_empty_title')}</p>
              <Link to="/generate" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>{t('scripts_generate')}</Link>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(s => {
            const isOpen = expanded === s.id
            const full   = detail[s.id]

            return (
              <div
                key={s.id}
                className="card"
                style={{
                  padding: 0, overflow: 'hidden',
                  border: isOpen ? '1px solid rgba(0,200,255,0.25)' : '1px solid var(--border)',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Row */}
                <button
                  onClick={() => toggleExpand(s.id)}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    textAlign: 'left',
                  }}
                >
                  {/* Script icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '1rem' }}>✍️</span>
                  </div>

                  {/* Topic + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.topic}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {loadingId === s.id ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('scripts_loading_detail')}</div>
                    ) : full ? (
                      <>
                        {/* Hook */}
                        <ScriptBlock label={t('scripts_hook_label')} text={full.hook} onCopy={() => copy(full.hook)} accent="#00C8FF" copyLabel={t('copy')} />
                        {/* Body */}
                        {full.body && <ScriptBlock label={t('scripts_body_label')} text={full.body} onCopy={() => copy(full.body)} accent="#7B5CF0" copyLabel={t('copy')} />}
                        {/* CTA */}
                        {full.cta && <ScriptBlock label={t('scripts_cta_label')} text={full.cta} onCopy={() => copy(full.cta)} accent="#00C9A7" copyLabel={t('copy')} />}
                        {/* Actions row */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <button
                            onClick={() => copy(full.fullScript || [full.hook, full.body, full.cta].filter(Boolean).join('\n\n'))}
                            className="btn btn-ghost btn-sm"
                          >
                            {t('scripts_copy_full')}
                          </button>
                          <button
                            onClick={() => navigate('/generate', {
                              state: {
                                topic:    s.topic,
                                niche:    full.niche    || s.niche    || '',
                                tone:     full.tone     || s.tone     || 'motivational',
                                language: full.language || s.language || 'en',
                              }
                            })}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            ✏️ Edit Again
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('scripts_no_detail')}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ScriptBlock({ label, text, onCopy, accent, copyLabel = 'Copy' }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accent }}>{label}</span>
        <button onClick={onCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.75rem', padding: '2px 6px', borderRadius: 4 }}>{copyLabel}</button>
      </div>
      <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  )
}
