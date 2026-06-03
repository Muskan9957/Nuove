import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import Logo from '../components/Logo'

const NICHES = [
  { id: 'comedy',        emoji: '😂', label: 'Comedy' },
  { id: 'fitness',       emoji: '💪', label: 'Fitness' },
  { id: 'finance',       emoji: '💰', label: 'Finance' },
  { id: 'food',          emoji: '🍜', label: 'Food' },
  { id: 'fashion',       emoji: '👗', label: 'Fashion' },
  { id: 'tech',          emoji: '⚡', label: 'Tech' },
  { id: 'lifestyle',     emoji: '✨', label: 'Lifestyle' },
  { id: 'education',     emoji: '📚', label: 'Education' },
  { id: 'travel',        emoji: '🗺️', label: 'Travel' },
  { id: 'motivation',    emoji: '🔥', label: 'Motivation' },
  { id: 'business',      emoji: '🚀', label: 'Business' },
  { id: 'relationships', emoji: '❤️', label: 'Relationships' },
]

const PLATFORMS = [
  {
    id: 'instagram', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <defs>
          <radialGradient id="ob-ig" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497"/>
            <stop offset="45%" stopColor="#fd5949"/>
            <stop offset="60%" stopColor="#d6249f"/>
            <stop offset="90%" stopColor="#285AEB"/>
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#ob-ig)"/>
        <rect x="6" y="6" width="12" height="12" rx="3.5" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="17" cy="7" r="1" fill="white"/>
      </svg>
    ),
    label: 'Instagram Reels',
    desc: 'Short, visual, trending audio',
    tag: 'Most Popular',
  },
  {
    id: 'youtube', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#FF0000"/>
        <path d="M19.6 8.2a2 2 0 00-1.4-1.4C17 6.5 12 6.5 12 6.5s-5 0-6.2.3a2 2 0 00-1.4 1.4C4 9.4 4 12 4 12s0 2.6.4 3.8a2 2 0 001.4 1.4c1.2.3 6.2.3 6.2.3s5 0 6.2-.3a2 2 0 001.4-1.4C20 14.6 20 12 20 12s0-2.6-.4-3.8z" fill="white"/>
        <path d="M10 14.5v-5l4.5 2.5-4.5 2.5z" fill="#FF0000"/>
      </svg>
    ),
    label: 'YouTube Shorts',
    desc: 'Discovery-first, evergreen content',
    tag: 'High CPM',
  },
  {
    id: 'both', icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="var(--gradient)" style={{fill: 'url(#ob-both)'}}/>
        <defs>
          <linearGradient id="ob-both" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#00E5FF"/>
            <stop offset="100%" stopColor="#7B5CF0"/>
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#ob-both)"/>
        <path d="M7 12h10M12 7l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: 'Both Platforms',
    desc: 'Maximize reach everywhere',
    tag: 'Best for Growth',
  },
]

const GOALS = [
  { id: 'grow',     emoji: '📈', label: 'Grow Followers',   desc: 'Build an audience from scratch' },
  { id: 'viral',    emoji: '🔥', label: 'Go Viral',         desc: 'Create hooks that catch fire' },
  { id: 'brand',    emoji: '💎', label: 'Build a Brand',    desc: 'Position as a niche expert' },
  { id: 'monetize', emoji: '💰', label: 'Monetize',         desc: 'Turn views into real income' },
]

const STEPS = [
  { id: 1, title: 'Pick your niche',    sub: "We'll personalise your AI scripts and trends around it." },
  { id: 2, title: 'Where do you post?', sub: "We'll optimise scripts for your platform's format." },
  { id: 3, title: "What's your goal?",  sub: "We'll calibrate the AI to match what you're building." },
]

const mobileStyles = `
  @media (max-width: 600px) {
    .ob-card { padding: 24px 18px !important; border-radius: 18px !important; }
    .ob-title { font-size: 1.45rem !important; }
    .ob-niche-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
    .ob-platform-card { flex-wrap: wrap; gap: 10px !important; padding: 14px 14px !important; }
    .ob-platform-tag { margin-left: 0 !important; }
    .ob-goal-card { padding: 14px 14px !important; gap: 12px !important; }
    .ob-cta-row { flex-direction: column !important; }
    .ob-cta-row button { width: 100% !important; margin-left: 0 !important; }
  }
  @media (max-width: 360px) {
    .ob-niche-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
`

export default function Onboarding() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [step, setStep]         = useState(1)
  const [exiting, setExiting]   = useState(false)
  const [niches, setNiches]     = useState([])   // multi-select array
  const [platform, setPlatform] = useState(null)
  const [goals, setGoals]       = useState([])   // multi-select array
  const [done, setDone]         = useState(false)

  const toggleNiche = (id) => {
    setNiches(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    )
  }

  const toggleGoal = (id) => {
    setGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  const goNext = () => {
    setExiting(true)
    setTimeout(() => {
      setStep(s => s + 1)
      setExiting(false)
    }, 260)
  }

  const skipNiche = () => {
    setNiches([])
    goNext()
  }

  const finish = () => {
    const prefs = { niches, platform, goals }
    localStorage.setItem('vs_onboarded', '1')
    localStorage.setItem('vs_prefs', JSON.stringify(prefs))
    api.markOnboarded().catch(() => {})
    api.savePrefs(prefs).catch(() => {})   // persist to backend so prefs survive new devices
    setDone(true)
    setTimeout(() => navigate('/dashboard'), 2000)
  }

  // Step 1 can always proceed (niches optional), step 2 needs platform, step 3 needs at least one goal
  const canNext = step === 1 || (step === 2 && platform)

  if (done) return (
    <div style={styles.root}>
      <div style={styles.doneWrap}>
        <div style={styles.doneOrb}>🎉</div>
        <h2 style={styles.doneTitle}>You're all set!</h2>
        <p style={styles.doneSub}>Taking you to your dashboard…</p>
        <div style={styles.doneBar}><div style={styles.doneBarFill} /></div>
      </div>
    </div>
  )

  const current = STEPS[step - 1]

  return (
    <div style={styles.root}>
      <style>{mobileStyles}</style>
      {/* Top bar */}
      <div style={styles.topBar}>
        <Logo size={32} />
        <div style={styles.stepPills}>
          {STEPS.map(s => (
            <div key={s.id} style={{
              ...styles.stepPill,
              background: s.id < step ? 'var(--gradient)' :
                          s.id === step ? 'rgba(255,95,31,0.25)' : 'var(--surface2)',
              border: s.id === step ? '1px solid rgba(255,95,31,0.5)' : '1px solid transparent',
            }}>
              {s.id < step ? '✓' : s.id}
            </div>
          ))}
        </div>
        <button
          onClick={() => { localStorage.setItem('vs_onboarded','1'); navigate('/dashboard') }}
          style={styles.skipBtn}
        >
          Skip →
        </button>
      </div>

      {/* Card */}
      <div className="ob-card" style={{ ...styles.card, opacity: exiting ? 0 : 1, transform: exiting ? 'translateY(10px)' : 'translateY(0)', transition: 'all 0.26s ease' }}>
        <div style={styles.stepBadge}>Step {step} of 3</div>
        <h1 className="ob-title" style={styles.title}>{current.title}</h1>
        <p style={styles.sub}>{current.sub}</p>

        {/* Step 1: Niche grid ,  multi-select */}
        {step === 1 && (
          <>
            <div className="ob-niche-grid" style={styles.nicheGrid}>
              {NICHES.map(n => {
                const selected = niches.includes(n.id)
                return (
                  <button
                    key={n.id}
                    onClick={() => toggleNiche(n.id)}
                    style={{
                      ...styles.nicheChip,
                      background: selected ? 'rgba(255,95,31,0.15)' : 'var(--surface2)',
                      border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                      boxShadow: selected ? '0 0 20px rgba(255,95,31,0.2)' : 'none',
                      transform: selected ? 'scale(1.04)' : 'scale(1)',
                      color: selected ? 'var(--text)' : 'var(--text-muted)',
                      position: 'relative',
                    }}
                  >
                    {selected && (
                      <div style={{
                        position: 'absolute', top: 5, right: 5,
                        width: 14, height: 14, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.55rem', color: '#fff', fontWeight: 800,
                      }}>✓</div>
                    )}
                    <span style={{ fontSize: '1.3rem' }}>{n.emoji}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{n.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Selection count + skip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: -8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>
                {niches.length > 0
                  ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{niches.length} selected</span>
                  : 'Select one or more'}
              </span>
              <button
                onClick={skipNiche}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-faint)', fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                  padding: '4px 0',
                }}
              >
                Skip this step →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Platform */}
        {step === 2 && (
          <div style={styles.platformGrid}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className="ob-platform-card"
                style={{
                  ...styles.platformCard,
                  background: platform === p.id ? 'rgba(255,95,31,0.08)' : 'var(--surface2)',
                  border: platform === p.id ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  boxShadow: platform === p.id ? '0 0 28px rgba(255,95,31,0.2)' : 'none',
                }}
              >
                <div style={styles.platformIcon}>{p.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.desc}</div>
                </div>
                <span className="ob-platform-tag" style={styles.platformTag}>
                  {p.tag}
                </span>
                {platform === p.id && <div style={styles.checkMark}>✓</div>}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Goal ,  multi-select */}
        {step === 3 && (
          <>
            <div style={styles.goalGrid}>
              {GOALS.map(g => {
                const selected = goals.includes(g.id)
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGoal(g.id)}
                    className="ob-goal-card"
                    style={{
                      ...styles.goalCard,
                      background: selected ? 'rgba(255,95,31,0.1)' : 'var(--surface2)',
                      border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                      boxShadow: selected ? '0 0 24px rgba(255,95,31,0.2)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{g.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{g.label}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{g.desc}</div>
                    </div>
                    {selected && <div style={styles.checkMark}>✓</div>}
                  </button>
                )
              })}
            </div>

            {/* Selection count */}
            <div style={{ marginBottom: 24, marginTop: -8 }}>
              <span style={{ fontSize: '0.8rem', color: goals.length > 0 ? 'var(--accent)' : 'var(--text-faint)', fontWeight: goals.length > 0 ? 600 : 400 }}>
                {goals.length > 0 ? `${goals.length} goal${goals.length > 1 ? 's' : ''} selected` : 'Select one or more'}
              </span>
            </div>
          </>
        )}

        {/* CTA */}
        <div className="ob-cta-row" style={styles.ctaRow}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={styles.backBtn}>← Back</button>
          )}
          {step < 3 ? (
            <button
              className="btn btn-primary btn-lg"
              style={{ marginLeft: 'auto', opacity: canNext ? 1 : 0.4 }}
              disabled={!canNext}
              onClick={goNext}
            >
              {step === 1 && niches.length === 0 ? 'Skip →' : 'Continue →'}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              style={{ marginLeft: 'auto', opacity: goals.length > 0 ? 1 : 0.4 }}
              disabled={goals.length === 0}
              onClick={finish}
            >
              Launch my dashboard 🚀
            </button>
          )}
        </div>
      </div>

      {/* Greeting */}
      <p style={styles.greeting}>
        Welcome, <strong style={{ color: 'var(--accent)' }}>{user?.name?.split(' ')[0] || 'Creator'}</strong> 👋 &nbsp;
        This takes 30 seconds.
      </p>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    gap: 24,
  },
  topBar: {
    width: '100%',
    maxWidth: 580,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepPills: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  stepPill: {
    width: 32, height: 32,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
    transition: 'all 0.3s ease',
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    padding: '6px 10px',
  },
  card: {
    width: '100%',
    maxWidth: 580,
    background: 'var(--surface-card)',
    backdropFilter: 'blur(24px)',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: '40px 36px',
    boxShadow: 'var(--shadow-glass)',
  },
  stepBadge: {
    display: 'inline-flex',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 12px',
    borderRadius: 99,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'var(--font-head)',
    fontSize: '1.9rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
    marginBottom: 8,
  },
  sub: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginBottom: 28,
    lineHeight: 1.6,
  },
  nicheGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginBottom: 32,
  },
  nicheChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '14px 8px',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    fontFamily: 'var(--font-body)',
  },
  platformGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 32,
  },
  platformCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 20px',
    borderRadius: 16,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    position: 'relative',
  },
  platformIcon: {
    flexShrink: 0,
  },
  platformTag: {
    marginLeft: 'auto',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    fontSize: '0.68rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '3px 10px',
    borderRadius: 99,
    whiteSpace: 'nowrap',
  },
  goalGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 32,
  },
  goalCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 20px',
    borderRadius: 16,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    position: 'relative',
  },
  checkMark: {
    position: 'absolute',
    right: 18,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 24, height: 24,
    background: 'var(--gradient)',
    backgroundImage: 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem',
    color: '#fff',
    fontWeight: 800,
  },
  ctaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    padding: '12px 20px',
    borderRadius: 14,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  greeting: {
    fontSize: '0.85rem',
    color: 'var(--text-faint)',
  },
  // Done screen
  doneWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    animation: 'fadeUp 0.4s ease forwards',
  },
  doneOrb: {
    fontSize: '4rem',
    animation: 'floatOrb 2s ease-in-out infinite',
  },
  doneTitle: {
    fontFamily: 'var(--font-head)',
    fontSize: '2rem',
    fontWeight: 800,
    color: 'var(--text)',
  },
  doneSub: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  doneBar: {
    width: 200,
    height: 4,
    background: 'var(--surface2)',
    borderRadius: 99,
    marginTop: 8,
    overflow: 'hidden',
  },
  doneBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00C8FF, #7B5CF0)',
    borderRadius: 99,
    animation: 'doneLoad 1.8s ease forwards',
  },
}
