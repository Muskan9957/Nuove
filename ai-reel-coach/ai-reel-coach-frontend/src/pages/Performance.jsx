import { useState, useEffect } from 'react'
import { api } from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n.jsx'
import { usePersistentState } from '../hooks/usePersistentState'

export default function Performance() {
  const toast   = useToast()
  const { t, lang } = useLang()
  const [form, setForm]       = usePersistentState('arc_perf_form', { topic: '', hookUsed: '', views: '', watchTimePercent: '', likes: '', shares: '', comments: '' })
  const [loading, setLd]      = useState(false)
  const [result, setResult]   = usePersistentState('arc_perf_result', null)
  const [history, setHistory] = useState([])
  const [hLoading, setHLd]    = useState(true)
  const [tab, setTab]         = usePersistentState('arc_perf_tab', 'analyze') // 'analyze' | 'history'

  useEffect(() => {
    api.perfHistory()
      .then(d => setHistory(d.logs))
      .catch(() => {})
      .finally(() => setHLd(false))
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLd(true); setResult(null)
    try {
      const payload = {
        topic:            form.topic,
        hookUsed:         form.hookUsed,
        views:            Number(form.views),
        watchTimePercent: Number(form.watchTimePercent),
        likes:            Number(form.likes),
        shares:           Number(form.shares),
        comments:         Number(form.comments),
      }
      const data = await api.analyze({ ...payload, language: lang })
      setResult(data.analysis)
      // refresh history
      api.perfHistory().then(d => setHistory(d.logs)).catch(() => {})
      toast('Analysis complete!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLd(false)
    }
  }

  const watchColor = pct =>
    pct >= 70 ? '#00C9A7' :
    pct >= 40 ? '#FFD60A' : '#FF6B6B'

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{t('performance_title')}</h1>
          <p className="page-sub">{t('performance_sub')}</p>
        </div>
        {result && tab === 'analyze' && (
          <button onClick={() => {
            setForm({ topic: '', hookUsed: '', views: '', watchTimePercent: '', likes: '', shares: '', comments: '' })
            setResult(null)
          }} className="btn btn-ghost btn-sm">
            New Analysis
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['analyze', 'history'].map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            style={{ ...styles.tab, ...(tab === tabKey ? styles.tabActive : {}) }}
          >
            {tabKey === 'analyze' ? `◈ ${t('performance_analyze_tab')}` : `📋 ${t('performance_history')} (${history.length})`}
          </button>
        ))}
      </div>

      {tab === 'analyze' && (
        <div style={styles.layout}>
          {/* Form */}
          <div className="card" style={{ position: 'sticky', top: 40 }}>
            <h2 style={styles.cardTitle}>{t('performance_topic')}</h2>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="field">
                <label>{t('performance_topic')}</label>
                <input className="input" placeholder={t('performance_topic_ph')} value={form.topic} onChange={set('topic')} required />
              </div>

              <div className="field">
                <label>{t('performance_hook')}</label>
                <textarea className="textarea" placeholder={t('performance_hook_ph')} value={form.hookUsed} onChange={set('hookUsed')} rows={3} required />
              </div>

              <div style={styles.metricsGrid}>
                {[
                  { k: 'views',            label: t('performance_views'),    ph: '0' },
                  { k: 'watchTimePercent', label: t('performance_watch'),    ph: '0-100' },
                  { k: 'likes',            label: t('performance_likes'),    ph: '0' },
                  { k: 'shares',           label: t('performance_shares'),   ph: '0' },
                  { k: 'comments',         label: t('performance_comments'), ph: '0' },
                ].map(({ k, label, ph }) => (
                  <div className="field" key={k}>
                    <label>{label}</label>
                    <input className="input" type="number" min="0" placeholder={ph} value={form[k]} onChange={set(k)} required />
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-teal btn-full" disabled={loading} style={{ marginTop: 4 }}>
                {loading
                  ? <><span className="spinner" />{t('performance_analyzing')}</>
                  : `◈ ${t('performance_btn')}`}
              </button>
            </form>
          </div>

          {/* Result */}
          <div>
            {!result && !loading && (
              <div className="card" style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="empty-state">
                  <div className="icon">◈</div>
                  <p style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {t('performance_feedback')}
                  </p>
                  <p>{t('performance_sub')}</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="card" style={{ height: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('performance_analyzing')}</p>
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Metrics summary */}
                <div style={styles.metricsRow}>
                  {[
                    { label: t('performance_views'),  value: Number(form.views).toLocaleString(), color: 'var(--accent)' },
                    { label: t('performance_watch'),  value: `${form.watchTimePercent}%`, color: watchColor(Number(form.watchTimePercent)) },
                    { label: t('performance_likes'),  value: Number(form.likes).toLocaleString(), color: 'var(--teal)' },
                    { label: t('performance_shares'), value: Number(form.shares).toLocaleString(), color: 'var(--yellow)' },
                  ].map(m => (
                    <div key={m.label} className="stat-card" style={{ flex: 1, padding: '16px', minWidth: 80 }}>
                      <div className="stat-label">{m.label}</div>
                      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.3rem', color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* AI Feedback */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={styles.aiBadge}>AI</div>
                    <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1rem' }}>{t('performance_feedback')}</h3>
                  </div>
                  <div style={styles.feedbackText}>
                    {result.feedback.split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} style={{ marginBottom: 14, lineHeight: 1.75, fontSize: '0.9375rem' }}>{para}</p>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className="badge badge-gray">{t('performance_saved')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div>
          {hLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 80, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }} />)}
            </div>
          ) : history.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="icon">◈</div>
                <p style={{ fontFamily: 'var(--font-head)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{t('performance_no_history')}</p>
                <p>{t('performance_no_history_sub')}</p>
                <button onClick={() => setTab('analyze')} className="btn btn-teal btn-sm" style={{ marginTop: 16 }}>{t('performance_analyze_tab')}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map(log => (
                <div key={log.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>{log.topic}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[
                      { l: t('performance_views'), v: log.views?.toLocaleString() },
                      { l: t('performance_watch'), v: `${log.watchTimePercent}%`, color: watchColor(log.watchTimePercent) },
                      { l: t('performance_likes'), v: log.likes?.toLocaleString() },
                    ].map(m => (
                      <div key={m.l} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1rem', color: m.color || 'var(--text)' }}>{m.v}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  tabs: {
    display: 'flex',
    gap: 6,
    marginBottom: 28,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 4,
    width: 'fit-content',
  },
  tab: {
    padding: '9px 18px',
    borderRadius: '9px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    fontWeight: '500',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--surface3)',
    color: 'var(--text)',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: 24,
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontFamily: 'var(--font-head)',
    fontWeight: '700',
    fontSize: '1rem',
    marginBottom: '20px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  metricsRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  aiBadge: {
    background: 'var(--teal)',
    color: '#07070E',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
    fontSize: '0.7rem',
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.06em',
  },
  feedbackText: {
    color: 'var(--text-muted)',
    lineHeight: 1.75,
  },
}
