import { useState, useEffect } from 'react'
import { api } from '../api'
import { useToast } from '../components/Toast'

const MAX_SAMPLES = 3
const MIN_CHARS   = 80   // per sample ,  too short to be useful

const PLACEHOLDER = [
  `e.g. paste a caption you've written, a script you filmed, or just how you naturally talk in your videos...`,
  `e.g. another past caption or script ,  the more samples you give, the more accurate your voice profile`,
  `e.g. a third sample (optional but makes the profile stronger)`,
]

const TRAIT_ICONS = {
  energy       : '⚡',
  sentenceStyle: '📝',
  vocabulary   : '📚',
  humor        : '😄',
  structure    : '🏗️',
  signature    : '✍️',
}

const TRAIT_LABELS = {
  energy       : 'Energy & Delivery',
  sentenceStyle: 'Sentence Style',
  vocabulary   : 'Vocabulary',
  humor        : 'Humor',
  structure    : 'Content Structure',
  signature    : 'Signature Patterns',
}

// DNA Strength based on sample count
function getDnaStrength(sampleCount) {
  if (!sampleCount || sampleCount === 0) return { pct: 0, label: 'Not built', color: 'var(--text-faint)' }
  if (sampleCount === 1) return { pct: 40, label: 'Basic', color: '#FFD60A' }
  if (sampleCount === 2) return { pct: 72, label: 'Strong', color: '#00C9A7' }
  return { pct: 100, label: 'Complete', color: '#00C8FF' }
}

export default function MyVoice() {
  const toast = useToast()

  const [samples,      setSamples]      = useState(['', '', ''])
  const [profile,      setProfile]      = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [fetching,     setFetching]     = useState(true)
  const [deleting,     setDeleting]     = useState(false)
  const [mode,         setMode]         = useState('view') // 'view' | 'strengthen'

  // Load existing profile on mount
  useEffect(() => {
    api.getVoiceProfile()
      .then(data => { if (data.profile) setProfile(data.profile) })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  const analyze = async () => {
    const filled = samples.filter(s => s.trim().length >= MIN_CHARS)
    if (filled.length === 0) {
      toast(`Paste at least one sample (${MIN_CHARS}+ characters)`, 'error')
      return
    }
    setLoading(true)
    try {
      const data = await api.analyzeVoice(filled)
      setProfile(data.profile)
      setSamples(['', '', ''])
      setMode('view')
      toast('Creator DNA updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const deleteProfile = async () => {
    if (!window.confirm('Delete your voice profile? Scripts will no longer be personalised.')) return
    setDeleting(true)
    try {
      await api.deleteVoiceProfile()
      setProfile(null)
      setSamples(['', '', ''])
      setMode('view')
      toast('Voice profile deleted', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (fetching) return (
    <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  const dna = getDnaStrength(profile?.sampleCount)

  // ── Input form (first build OR strengthening) ─────────────────────
  const showForm = !profile || mode === 'strengthen'

  return (
    <div className="page-enter" style={{ maxWidth: 740, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Creator DNA</h1>
          {profile && (
            <span style={{
              padding: '3px 12px', borderRadius: 99,
              fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              background: `${dna.color}18`,
              border: `1px solid ${dna.color}40`,
              color: dna.color,
            }}>
              ✓ {dna.label}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 560 }}>
          Paste samples of your past captions, scripts, or how you naturally talk.
          The AI extracts your voice fingerprint ,  every script it generates will sound like <em>you</em>, not a generic AI.
        </p>
      </div>

      {/* ── FORM: build or strengthen ─────────────────────────────────── */}
      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Back button when in strengthen mode */}
          {mode === 'strengthen' && profile && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setMode('view'); setSamples(['', '', '']) }}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ← Back to profile
            </button>
          )}

          {/* Strengthen context banner */}
          {mode === 'strengthen' && profile && (
            <div style={{
              padding: '14px 18px', borderRadius: 12,
              background: 'rgba(0,200,255,0.05)',
              border: '1px solid rgba(0,200,255,0.2)',
            }}>
              <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: '#00C8FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Strengthening your DNA
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                Add new samples ,  your old fingerprint will be re-analysed alongside these.
                Great for when your style has evolved or you want sharper accuracy.
              </p>
            </div>
          )}

          <div className="card">
            <h2 style={cardTitleStyle}>
              {mode === 'strengthen' ? 'Add New Content Samples' : 'Paste Your Content Samples'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.6 }}>
              Give 1–3 samples of your real content ,  past captions, scripts you've filmed, or voice notes transcribed.
              The more authentic, the better the fingerprint.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {samples.map((s, i) => (
                <div key={i} className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={fieldLabelStyle}>
                      Sample {i + 1}{i > 0 ? ' (optional)' : ''}
                    </label>
                    <span style={{
                      fontSize: '0.68rem', fontFamily: 'var(--font-mono)',
                      color: s.length < MIN_CHARS && s.length > 0 ? '#FF9F43' : 'var(--text-faint)',
                    }}>
                      {s.length} chars{s.length > 0 && s.length < MIN_CHARS ? ` · need ${MIN_CHARS - s.length} more` : ''}
                    </span>
                  </div>
                  <textarea
                    className="textarea"
                    placeholder={PLACEHOLDER[i]}
                    value={s}
                    onChange={e => {
                      const next = [...samples]
                      next[i] = e.target.value
                      setSamples(next)
                    }}
                    rows={5}
                    style={{ fontSize: '0.9rem', lineHeight: 1.65 }}
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={analyze}
              disabled={loading || samples.filter(s => s.trim().length >= MIN_CHARS).length === 0}
              style={{ marginTop: 16, height: 52, fontSize: '1rem', fontWeight: 700 }}
            >
              {loading
                ? <><span className="spinner" /> {mode === 'strengthen' ? 'Strengthening DNA…' : 'Building your DNA…'}</>
                : mode === 'strengthen' ? '↑ Strengthen My Creator DNA' : '✦ Build My Creator DNA'}
            </button>
          </div>

          <div className="card card-sm" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              What makes a good sample?
            </div>
            {[
              'A caption you wrote for a reel you loved',
              'A script you actually filmed ,  hook, body, CTA',
              'A voice note transcript of how you naturally explain something',
              'A thread or post you wrote without overthinking it',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--teal)', flexShrink: 0 }}>✓</span> {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROFILE VIEW ─────────────────────────────────────────────── */}
      {profile && mode === 'view' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary + DNA strength card */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(0,200,255,0.06), rgba(160,110,255,0.06))',
            border: '1px solid rgba(0,200,255,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00C8FF', marginBottom: 6 }}>
                  Your Voice Fingerprint
                </div>
                <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', margin: 0, lineHeight: 1.45 }}>
                  "{profile.summary}"
                </p>
              </div>
            </div>

            {/* DNA Strength bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  DNA Strength
                </span>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: dna.color }}>
                  {dna.label} · {dna.pct}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${dna.pct}%`,
                  background: dna.pct === 100
                    ? 'linear-gradient(90deg, #00C8FF, #7B5CF0)'
                    : dna.color,
                  borderRadius: 99,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              {dna.pct < 100 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', margin: '6px 0 0', fontFamily: 'var(--font-mono)' }}>
                  Add {(profile.sampleCount || 1) >= 2 ? '1 more sample' : '1–2 more samples'} to reach {dna.pct < 72 ? 'Strong' : 'Complete'} DNA →{' '}
                  <button
                    onClick={() => setMode('strengthen')}
                    style={{ background: 'none', border: 'none', color: '#00C8FF', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: 0, textDecoration: 'underline' }}
                  >
                    Strengthen now
                  </button>
                </p>
              )}
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', margin: 0, fontFamily: 'var(--font-mono)' }}>
              Last updated: {profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
              {profile.sampleCount ? ` · ${profile.sampleCount} sample${profile.sampleCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>

          {/* How it's being used ,  the "ongoing value" card */}
          <div className="card card-sm" style={{
            background: 'rgba(0,201,167,0.04)',
            border: '1px solid rgba(0,201,167,0.2)',
          }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#00C9A7', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              ✓ Active on every generation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {[
                { icon: '🎯', label: 'Hook style', desc: 'Hooks match your natural opening pattern' },
                { icon: '🗣️', label: 'Tone & voice', desc: 'Energy and personality baked into every line' },
                { icon: '🔚', label: 'CTA style', desc: 'Sign-off mirrors how you actually close' },
                { icon: '✍️', label: 'Signature phrases', desc: 'Your go-to words and expressions surface naturally' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: 0 }}>
                Every script you generate at <a href="/generate" style={{ color: '#00C9A7', textDecoration: 'none', fontWeight: 600 }}>Generate →</a> uses this fingerprint silently in the background. You'll see a <strong style={{ color: 'var(--text-muted)' }}>✦ Writing with your Creator DNA</strong> badge confirming it's active.
              </p>
            </div>
          </div>

          {/* Traits grid */}
          <div className="card">
            <h2 style={cardTitleStyle}>Style Breakdown</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {Object.entries(TRAIT_ICONS).map(([key, icon]) => {
                const val = profile[key]
                if (!val) return null
                return (
                  <div key={key} style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: '1rem' }}>{icon}</span>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>
                        {TRAIT_LABELS[key]}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{val}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* What the AI does with it */}
          <div className="card card-sm" style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.15)' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#00C8FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              What the AI is told about you
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.65, fontStyle: 'italic' }}>
              "{profile.promptInstruction}"
            </p>
          </div>

          {/* Action buttons ,  available to everyone */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              onClick={() => { setMode('strengthen'); setSamples(['', '', '']) }}
              style={{ flex: 1, minWidth: 140 }}
            >
              ↑ Strengthen DNA
            </button>
            <button
              className="btn"
              onClick={deleteProfile}
              disabled={deleting}
              style={{
                flex: 1, minWidth: 140,
                background: 'rgba(255,107,107,0.08)',
                border: '1px solid rgba(255,107,107,0.25)',
                color: '#FF6B6B',
              }}
            >
              {deleting ? <><span className="spinner" /> Deleting…</> : '🗑 Delete Profile'}
            </button>
          </div>

          {/* When to re-strengthen tip */}
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: 0, lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text-muted)' }}>When should you strengthen?</strong> Whenever your style evolves, you start creating in a new niche, or you feel the generated scripts don't quite sound like you anymore. More samples = sharper fingerprint.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const cardTitleStyle = {
  fontFamily: 'var(--font-head)',
  fontWeight: 700,
  fontSize: '1rem',
  marginBottom: 16,
}

const fieldLabelStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
