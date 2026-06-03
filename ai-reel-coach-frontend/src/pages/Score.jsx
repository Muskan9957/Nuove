import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n.jsx'
import { MicButton, SpeakButton } from '../components/VoiceAssistant'

const gradeColor  = { A: '#00C9A7', B: '#88F0D0', C: '#FF9F43', D: '#FF6B47', F: '#FF6B6B' }
const gradeLabel  = { A: 'Excellent', B: 'Good', C: 'Average', D: 'Weak', F: 'Poor' }

const SCORE_LANGS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'id', label: 'Bahasa' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
]

function BigScoreRing({ score }) {
  const r    = 68
  const circ = 2 * Math.PI * r
  const fill = circ - (score / 100) * circ
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F'
  const color = gradeColor[grade]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface3)" strokeWidth="10" />
        <circle
          cx="80" cy="80" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          style={{ filter: `drop-shadow(0 0 12px ${color})`, transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="80" y="71" textAnchor="middle" fontFamily="var(--font-head)" fontSize="30" fontWeight="800" fill="var(--text)">{score}</text>
        <text x="80" y="85" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--text-faint)">out of 100</text>
        <text x="80" y="100" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill={color}>
          {grade} ,  {gradeLabel[grade]}
        </text>
      </svg>
    </div>
  )
}

export default function Score() {
  const toast    = useToast()
  const { t, lang } = useLang()
  const location = useLocation()

  const [hook, setHook]             = useState('')
  const [hookLang, setHookLang]     = useState(() => localStorage.getItem('arc_script_lang') || 'en')
  const [loading, setLd]            = useState(false)
  const [result, setResult]         = useState(null)
  const [accepted, setAccepted]     = useState(false)
  const [micInterim, setMicInterim] = useState('')
  const [alternatives, setAlts]     = useState([])
  const [altsLoading, setAltsLd]    = useState(false)
  const [selectedAlt, setSelectedAlt] = useState(null) // index of currently scored alternative

  // Pre-fill hook from Templates page
  useEffect(() => {
    const stateHook = location.state?.hook
    if (stateHook) {
      setHook(stateHook)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const scoreHook = async (e, overrideHook, keepAlts = false) => {
    if (e?.preventDefault) e.preventDefault()
    const hookToScore = overrideHook || hook
    if (!hookToScore.trim()) { toast('Please enter a hook', 'error'); return }
    setLd(true); setResult(null); setAccepted(false)
    if (!keepAlts) { setAlts([]); setSelectedAlt(null) }
    try {
      const data = await api.scoreHook({ hookText: hookToScore, language: hookLang })
      setResult(data.hookScore)
      // Only fetch fresh alternatives on a new hook submission, not when cycling through alts
      if (!keepAlts && data.hookScore.score < 80) {
        setAltsLd(true)
        api.hookAlternatives({ hookText: hookToScore, score: data.hookScore.score, language: hookLang })
          .then(r => setAlts(r.alternatives || []))
          .catch(() => {})
          .finally(() => setAltsLd(false))
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLd(false)
    }
  }

  const useAlternative = (altHook, idx) => {
    setHook(altHook)
    setSelectedAlt(idx)
    scoreHook(null, altHook, true) // keepAlts = true ,  don't wipe the list
  }

  const statusColor = s =>
    s === 'Post Ready' ? '#00C9A7' :
    s === 'Needs Improvement' ? '#FF9F43' : '#FF6B6B'

  // TTS text for the result
  const ttsText = result
    ? `Your hook scored ${result.score} out of 100. Grade ${result.score >= 90 ? 'A' : result.score >= 75 ? 'B' : result.score >= 60 ? 'C' : result.score >= 50 ? 'D' : 'F'}. ${result.reasons?.join('. ')}`
    : null

  return (
    <div className="page-enter">
      <h1 className="page-title">{t('score_title')}</h1>
      <p className="page-sub">{t('score_sub')}</p>

      <div style={styles.layout}>
        {/* Form */}
        <div className="card" style={{ position: 'sticky', top: 40 }}>
          <h2 style={styles.cardTitle}>{t('score_label')}</h2>
          <form onSubmit={scoreHook} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="field">
              {/* Label + char counter row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <label style={{ marginBottom: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t('score_hook_text')}
                </label>
                <span style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: hook.length > 900 ? '#FF6B6B' : hook.length > 700 ? 'var(--yellow)' : 'var(--text-faint)',
                  transition: 'color 0.2s',
                }}>
                  {hook.length}/1000
                </span>
              </div>

              {/* Language select */}
              <div style={{ marginBottom: 8 }}>
                <select
                  value={hookLang}
                  onChange={e => { setHookLang(e.target.value); localStorage.setItem('arc_script_lang', e.target.value) }}
                  title="Language for mic & scoring"
                  className="select"
                  style={{ width: 140, fontSize: '0.82rem', height: 34, padding: '0 8px' }}
                >
                  {SCORE_LANGS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Textarea + mic side by side */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  className="textarea"
                  placeholder={'e.g. "I was broke at 25. Here\'s what changed everything."'}
                  value={micInterim || hook}
                  onChange={e => {
                    setMicInterim('')
                    setHook(e.target.value.slice(0, 1000))
                  }}
                  rows={5}
                  required
                  maxLength={1000}
                  style={{
                    flex: 1, minWidth: 0, resize: 'vertical', fontSize: '0.95rem', lineHeight: 1.6,
                    opacity: micInterim ? 0.75 : 1,
                    fontStyle: micInterim ? 'italic' : 'normal',
                    transition: 'opacity 0.15s, font-style 0s',
                  }}
                />
                <MicButton
                  onResult={text => setHook(text.slice(0, 1000))}
                  onInterim={text => setMicInterim(text.slice(0, 1000))}
                  lang={hookLang}
                  style={{ marginTop: 4 }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading
                ? <><span className="spinner" />{t('score_scoring')}</>
                : t('score_btn_score')}
            </button>
          </form>

          {/* Tips */}
          <div style={styles.tips}>
            <div style={styles.tipsTitle}>{t('score_tips_title')}</div>
            {[t('score_tip_1'), t('score_tip_2'), t('score_tip_3'), t('score_tip_4')].map((tip, i) => (
              <div key={i} style={styles.tip}><span style={{ color: 'var(--teal)' }}>✓</span> {tip}</div>
            ))}
          </div>
        </div>

        {/* Result */}
        <div>
          {!result && !loading && (
            <div className="card" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                <div className="icon">◎</div>
                <p style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {t('score_empty')}
                </p>
                <p>{t('score_empty_sub')}</p>
              </div>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Score + reasons */}
              <div className="card" style={styles.scoreCard}>
                <BigScoreRing score={result.score} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.4rem' }}>
                      {result.score}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                    </span>
                    <span style={{
                      fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                      padding: '4px 12px', borderRadius: 99,
                      background: `${statusColor(result.status)}22`,
                      color: statusColor(result.status),
                      border: `1px solid ${statusColor(result.status)}44`,
                    }}>
                      {result.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    {t('score_reasons_label')}
                  </div>
                  <div className="reasons">
                    {result.reasons?.map((r, i) => (
                      <div key={i} className="reason-item"><div className="reason-dot" />{r}</div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16 }}><SpeakButton text={ttsText} /></div>
                </div>
              </div>

              {/* ── Alternatives ,  right here, can't miss them ── */}
              {result.score < 80 && (
                <div className="card" style={{
                  border: '1px solid rgba(255,160,0,0.25)',
                  background: 'linear-gradient(135deg, rgba(255,160,0,0.04), rgba(255,95,31,0.04))',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: altsLoading && alternatives.length === 0 ? 8 : 16 }}>
                    <span style={{ fontSize: '1.1rem' }}>⚡</span>
                    <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '0.95rem' }}>
                      Here are 3 stronger versions
                    </span>
                    {altsLoading && <span className="spinner" style={{ width: 14, height: 14, marginLeft: 4 }} />}
                  </div>

                  {altsLoading && alternatives.length === 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 0 }}>
                      Writing better hooks for you…
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {alternatives.map((alt, i) => {
                      const isSelected = selectedAlt === i
                      return (
                        <div key={i} style={{
                          padding: '14px 16px', borderRadius: 10,
                          background: isSelected ? 'rgba(0,200,255,0.07)' : 'var(--surface)',
                          border: isSelected ? '1px solid rgba(0,200,255,0.35)' : '1px solid var(--border)',
                          transition: 'all 0.15s ease',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                            <p style={{ fontSize: '0.93rem', color: 'var(--text)', lineHeight: 1.55, margin: 0, fontWeight: 500, flex: 1 }}>
                              "{alt.hook}"
                            </p>
                            {isSelected && (
                              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(0,200,255,0.15)', color: '#00C8FF', border: '1px solid rgba(0,200,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {loading ? 'scoring…' : '✓ active'}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.74rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontStyle: 'italic', margin: '0 0 12px' }}>
                            {alt.reason}
                          </p>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => useAlternative(alt.hook, i)}
                            disabled={isSelected && loading}
                            style={{ fontSize: '0.8rem', fontWeight: 700 }}
                          >
                            {isSelected && loading ? <><span className="spinner" /> Scoring…</> : 'Score this →'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {result.score >= 80 && (
                <div className="card card-sm" style={{ background: 'var(--teal-dim)', border: '1px solid rgba(0,201,167,0.2)' }}>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--teal)', marginBottom: 6 }}>
                    {t('score_ready_title')}
                  </div>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{t('score_ready_body')}</p>
                </div>
              )}

              {/* Scored hook ,  now at the bottom, less prominent */}
              <div className="card card-sm">
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {t('score_scored_hook')}
                </div>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-muted)', borderLeft: '3px solid var(--border)', paddingLeft: 14 }}>
                  "{hook}"
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(380px, 440px) 1fr',
    gap: 28,
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontFamily: 'var(--font-head)',
    fontWeight: '700',
    fontSize: '1rem',
    marginBottom: '20px',
  },
  scoreCard: {
    display: 'flex',
    gap: 28,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  tips: {
    marginTop: 24,
    padding: '16px',
    background: 'var(--surface2)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  tipsTitle: {
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-faint)',
    marginBottom: 6,
  },
  tip: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    display: 'flex',
    gap: 8,
  },
}
