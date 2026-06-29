import { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import { MicButton, SpeakButton } from '../components/VoiceAssistant'
import { useLang } from '../i18n.jsx'
import { usePersistentState } from '../hooks/usePersistentState'

const STYLE_COLORS = {
  Short:    '#00C8FF',
  Story:    '#00C9A7',
  Question: '#FFD60A',
  Bold:     '#7B5CF0',
}

const NICHES = ['General', 'Fitness', 'Business & Finance', 'Food', 'Tech', 'Motivation', 'Relationships', 'Travel', 'Beauty']
const TONES  = ['Engaging', 'Funny', 'Inspirational', 'Educational', 'Bold', 'Conversational']

function PulsingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#fff',
            animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

export default function Captions() {
  const { t, lang } = useLang()
  const [topic, setTopic]     = usePersistentState('arc_cap_topic', '')
  const [niche, setNiche]     = usePersistentState('arc_cap_niche', 'General')
  const [tone, setTone]       = usePersistentState('arc_cap_tone', 'Engaging')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = usePersistentState('arc_cap_result', null)
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState({})
  const [copiedAll, setCopiedAll] = useState(false)

  const resultsRef = useRef(null)

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.generateCaptions({ topic, niche, tone, language: lang })
      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setTopic('')
    setResult(null)
  }

  const copyCaption = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
    } catch {}
  }

  const copyAllHashtags = async () => {
    if (!result?.hashtags?.length) return
    try {
      await navigator.clipboard.writeText(result.hashtags.join(' '))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {}
  }

  const allCaptionText = result?.captions?.map(c => c.text).join('\n\n') || ''

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{t('captions_title')}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>{t('captions_sub')}</p>
        </div>
        {result && (
          <button onClick={handleReset} className="btn btn-ghost btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            New Caption
          </button>
        )}
      </div>

      <form onSubmit={handleGenerate} style={{ maxWidth: 720 }}>
        {/* Topic */}
        <div className="field" style={{ marginBottom: 18 }}>
          <label style={s.label}>{t('generate_topic')}</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type="text"
              placeholder={t('captions_topic_ph')}
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
            <MicButton onResult={text => setTopic(text)} />
          </div>
        </div>

        {/* Niche + Tone row */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label style={s.label}>{t('generate_niche')}</label>
            <select className="input" value={niche} onChange={e => setNiche(e.target.value)}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label style={s.label}>{t('generate_tone')}</label>
            <select className="input" value={tone} onChange={e => setTone(e.target.value)}>
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ color: '#FF6B6B', fontSize: '0.85rem', marginBottom: 14, padding: '10px 14px', background: 'rgba(255,107,107,0.08)', borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !topic.trim()}
          style={{ minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {loading ? (<>{t('captions_generating')}{<PulsingDots />}</>) : t('captions_btn')}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div ref={resultsRef} style={{ marginTop: 40, maxWidth: 720 }}>
          {/* Caption Cards */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={s.sectionTitle}>{t('captions_section')}</h2>
            <SpeakButton text={allCaptionText} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {result.captions?.map((cap, i) => {
              const badgeColor = STYLE_COLORS[cap.style] || 'var(--accent)'
              return (
                <div key={i} className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: badgeColor,
                      background: `${badgeColor}18`,
                      border: `1px solid ${badgeColor}40`,
                      padding: '3px 9px', borderRadius: 99,
                    }}>
                      {cap.style}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => copyCaption(cap.text, i)}
                      style={{
                        ...s.copyBtn,
                        color: copied[i] ? 'var(--teal)' : 'var(--text-muted)',
                        borderColor: copied[i] ? 'var(--teal)' : 'var(--border)',
                      }}
                    >
                      {copied[i] ? t('captions_copied') : t('captions_copy')}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>
                    {cap.text}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Hashtags */}
          {result.hashtags?.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <h2 style={s.sectionTitle}>{t('captions_hashtags')}</h2>
                <button
                  onClick={copyAllHashtags}
                  style={{
                    ...s.copyBtn,
                    color: copiedAll ? 'var(--teal)' : 'var(--accent)',
                    borderColor: copiedAll ? 'var(--teal)' : 'var(--accent)',
                    background: copiedAll ? 'rgba(0,201,167,0.08)' : 'rgba(255,95,31,0.08)',
                  }}
                >
                  {copiedAll ? t('captions_copied_all') : t('captions_copy_all')}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    onClick={() => copyCaption(tag, `tag-${i}`)}
                    title="Click to copy"
                    style={{
                      padding: '5px 12px', borderRadius: 99,
                      background: 'var(--surface2)',
                      border: `1px solid ${copied[`tag-${i}`] ? 'var(--teal)' : 'var(--border)'}`,
                      fontSize: '0.8rem', color: copied[`tag-${i}`] ? 'var(--teal)' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  label: {
    display: 'block', fontSize: '0.8rem', fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: 6,
    fontFamily: 'var(--font-body)', letterSpacing: '0.01em',
  },
  sectionTitle: {
    fontFamily: 'var(--font-head)', fontSize: '1rem', fontWeight: 700, margin: 0,
  },
  copyBtn: {
    padding: '5px 12px', borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'transparent',
    fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
    cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: 4,
    whiteSpace: 'nowrap',
  },
}
