import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const C = {
  green:  '#10B981',
  violet: '#8B5CF6',
  pink:   '#EC4899',
  amber:  '#F59E0B',
  cyan:   '#06B6D4',
  teal:   '#14B8A6',
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

const SOURCE_META = {
  'google-trends': { label: '🔍 Google Trends', color: '#4285F4' },
  'google':        { label: 'Google Trends',    color: '#4285F4' },
  'youtube':       { label: 'YouTube',          color: '#FF0000' },
  'instagram':     { label: '📸 Instagram',      color: '#E1306C' },
  'spotify':       { label: '🎵 Spotify',        color: '#1DB954' },
  'x':             { label: '🐦 X',              color: '#1DA1F2' },
  'ai':            { label: '✨ AI Pick',        color: C.violet  },
  'static-fallback': { label: 'Nuove Fallback', color: '#64748B' },
}

export default function TrendDetailModal({ isOpen, onClose, trend, onGenerateScript }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden' // Prevent bg scroll
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'auto'
    }
  }, [isOpen, onClose])

  if (!isOpen || !trend) return null

  // Safety fallback for formats
  const title = trend.title || (typeof trend === 'string' ? trend : '')
  const description = trend.description || ''
  const keywords = Array.isArray(trend.keywords) ? trend.keywords : []
  const evidence = Array.isArray(trend.evidence) ? trend.evidence : []
  const sources = Array.isArray(trend.sources) ? trend.sources : (trend.source ? [trend.source] : ['ai'])
  const confidence = trend.confidence || 'Medium'
  const region = trend.region || 'India'
  const niche = trend.niche || 'General'
  const category = trend.category || 'Lifestyle'
  
  const getConfidenceColor = (conf) => {
    const c = conf?.toLowerCase()
    if (c === 'high') return '#10B981' // Green
    if (c === 'medium') return '#FF8C00' // Amber
    if (c === 'low') return '#FF2D6F' // Pink
    return '#B36DFF'
  }
  const confColor = getConfidenceColor(confidence)
  const catColor = CATEGORY_COLORS[category] || C.violet

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 16 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-faint)',
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
          <h2 style={{
            margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-creator)',
            fontWeight: 800, color: 'var(--text)', lineHeight: 1.3
          }}>
            {title}
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1 }}>
          <p style={{
            margin: '0 0 24px', fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6
          }}>
            {description}
          </p>

          {keywords.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Keywords
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {keywords.map(kw => (
                  <span key={kw} style={{
                    fontSize: '0.75rem', padding: '4px 10px', borderRadius: 8,
                    background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)'
                  }}>{kw}</span>
                ))}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Discovered On
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sources.map(src => {
                  const meta = SOURCE_META[src] || SOURCE_META.ai
                  return (
                    <div key={src} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 99,
                      background: `${meta.color}10`, border: `1px solid ${meta.color}30`,
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {evidence.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Evidence
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {evidence.map((ev, i) => {
                  const meta = SOURCE_META[ev.source] || SOURCE_META.ai
                  return (
                    <div key={i} style={{
                      padding: '12px', borderRadius: 12, background: 'var(--surface2)',
                      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4
                    }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.4 }}>
                        {ev.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--surface2)', borderRadius: '0 0 24px 24px'
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 99, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          <button 
            onClick={() => { onClose(); onGenerateScript(title) }}
            style={{
              padding: '10px 24px', borderRadius: 99, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(109,40,217,0.3)'
            }}
          >
            Generate Script →
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}