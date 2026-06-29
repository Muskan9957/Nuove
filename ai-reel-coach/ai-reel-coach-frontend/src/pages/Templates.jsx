import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useLang } from '../i18n.jsx'
import { useToast } from '../components/Toast'
import { usePrefs } from '../hooks/usePrefs'

const TABS = [
  { key: '',       label: 'All'     },
  { key: 'script', label: 'Scripts' },
  { key: 'hook',   label: 'Hooks'   },
  { key: 'cta',    label: 'CTAs'    },
]

const TYPE_COLORS = {
  script: { color: 'var(--accent)',  bg: 'var(--accent-dim)'  },
  hook:   { color: 'var(--teal)',    bg: 'var(--teal-dim)'    },
  cta:    { color: '#FFD60A',        bg: 'rgba(255,214,10,0.12)' },
}

function TemplateCard({ template, onUse, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const typeStyle = TYPE_COLORS[template.type] || TYPE_COLORS.hook

  return (
    <div className="card card-sm" style={tmStyles.card}>
      <div style={tmStyles.cardHeader}>
        <div style={tmStyles.cardName}>{template.name}</div>
        <span style={{
          ...tmStyles.typeBadge,
          background: typeStyle.bg,
          color: typeStyle.color,
        }}>
          {template.type || 'template'}
        </span>
      </div>

      <div style={tmStyles.preview}>
        {template.content}
      </div>

      {template.niche && (
        <div style={tmStyles.nicheTag}>#{template.niche}</div>
      )}

      <div style={tmStyles.actions}>
        <button
          onClick={() => onUse(template)}
          className="btn btn-primary btn-sm"
          style={{ flex: 1, justifyContent: 'center' }}
        >
          Use Template
        </button>

        {confirming ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { onDelete(template.id); setConfirming(false) }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,107,107,0.4)',
                background: 'rgba(255,107,107,0.12)',
                color: '#FF6B6B',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.78rem',
              }}
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            title="Delete template"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

export default function Templates() {
  const { t }    = useLang()
  const navigate = useNavigate()
  const toast    = useToast()
  const { primaryNiche } = usePrefs()

  const [activeTab,  setActiveTab]  = useState('')
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getTemplates(activeTab || undefined)
      .then(data => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [activeTab])

  const handleUse = (template) => {
    if (template.type === 'script') {
      localStorage.setItem('arc_prefill_topic', template.content)
      navigate('/generate', { state: { topic: template.content } })
    } else if (template.type === 'hook') {
      navigate('/score', { state: { hook: template.content } })
    } else {
      // CTA or others ,  go to generate with content note
      localStorage.setItem('arc_prefill_topic', template.name)
      navigate('/generate', { state: { topic: template.name } })
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast('Template deleted', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // Sort: niche-matching templates float to top
  const filtered = primaryNiche
    ? [...templates].sort((a, b) => {
        const aMatch = a.niche?.toLowerCase() === primaryNiche.toLowerCase() ? -1 : 0
        const bMatch = b.niche?.toLowerCase() === primaryNiche.toLowerCase() ? -1 : 0
        return aMatch - bMatch
      })
    : templates

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">{t('templates_title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p className="page-sub" style={{ margin: 0 }}>Reuse your best content frameworks and saved topics.</p>
          {primaryNiche && (
            <span style={{
              fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '3px 10px', borderRadius: 99,
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
              color: '#A855F7', letterSpacing: '0.05em',
            }}>
              {primaryNiche.charAt(0).toUpperCase() + primaryNiche.slice(1)} first
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={tmStyles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...tmStyles.tab,
              borderBottom: activeTab === tab.key
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={tmStyles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              height: 180,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              animation: 'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div className="empty-state">
            <div className="icon">📋</div>
            <p style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              No templates yet
            </p>
            <p style={{ marginBottom: 20 }}>
              {activeTab
                ? `No ${activeTab} templates found. Try a different tab.`
                : 'Save topics from Trending or create scripts to build your template library.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/trending')} className="btn btn-primary btn-sm">
                Browse Trending
              </button>
              <button onClick={() => navigate('/generate')} className="btn btn-ghost btn-sm">
                Generate Script
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
            {filtered.length} template{filtered.length !== 1 ? 's' : ''}
          </div>
          <div style={tmStyles.grid}>
            {filtered.map(tmpl => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                onUse={handleUse}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const tmStyles = {
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--border)',
    marginBottom: 28,
    overflowX: 'auto',
  },
  tab: {
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid transparent',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardName: {
    fontFamily: 'var(--font-head)',
    fontWeight: 600,
    fontSize: '0.9rem',
    lineHeight: 1.3,
    flex: 1,
  },
  typeBadge: {
    display: 'inline-flex',
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: '0.68rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  preview: {
    fontSize: '0.82rem',
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    flex: 1,
  },
  nicheTag: {
    fontSize: '0.72rem',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
  },
  actions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
}
