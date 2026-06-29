import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Typewriter hook ─────────────────────────────────────────── */
function useTypewriter(lines, speed = 38) {
  const [display, setDisplay] = useState('')
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [pausing, setPausing] = useState(false)

  useEffect(() => {
    if (pausing) {
      const t = setTimeout(() => { setPausing(false); setDisplay(''); setCharIdx(0); setLineIdx(i => (i + 1) % lines.length) }, 1800)
      return () => clearTimeout(t)
    }
    if (charIdx < lines[lineIdx].length) {
      const t = setTimeout(() => { setDisplay(lines[lineIdx].slice(0, charIdx + 1)); setCharIdx(c => c + 1) }, speed)
      return () => clearTimeout(t)
    } else {
      setPausing(true)
    }
  }, [charIdx, lineIdx, pausing, lines, speed])

  return display
}

/* ── Counter hook ────────────────────────────────────────────── */
function useCounter(target, duration = 1600) {
  const [val, setVal] = useState(0)
  const ref = useRef(false)
  useEffect(() => {
    if (ref.current) return
    ref.current = true
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(Math.floor(p * p * target))
      if (p < 1) requestAnimationFrame(tick)
      else setVal(target)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

/* ── Intersection observer hook ─────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

/* ── Feature Card ────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, accent, delay = 0, inView }) {
  return (
    <div style={{
      background: 'rgba(13,10,28,0.7)',
      border: `1px solid ${accent}33`,
      borderRadius: 20,
      padding: '28px 24px',
      borderTop: `2px solid ${accent}`,
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      <div style={{ fontSize: '2rem', marginBottom: 14 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.05rem', color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ fontSize: '0.83rem', color: '#8BA4CC', lineHeight: 1.65 }}>{desc}</div>
    </div>
  )
}

/* ── Stat ────────────────────────────────────────────────────── */
function Stat({ value, suffix = '', label, accent }) {
  const count = useCounter(value)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: 'clamp(2.4rem,5vw,3.6rem)', letterSpacing: '-0.04em', background: `linear-gradient(135deg, ${accent}, #fff)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#6B8DB8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6 }}>{label}</div>
    </div>
  )
}

/* ── Mock Script Demo ────────────────────────────────────────── */
const SCRIPT_LINES = [
  "Stop scrolling — this changed my life in 30 days...",
  "Nobody talks about this secret to going viral fast...",
  "I tried 100 hooks so you don't have to — here's #1...",
  "This one mistake is killing your content reach daily...",
]

function ScriptDemo() {
  const text = useTypewriter(SCRIPT_LINES, 42)
  return (
    <div style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFBD2E' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27C93F' }} />
        <span style={{ marginLeft: 8, fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#4A6A9A' }}>AI Script Generator</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: '#4A6A9A', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>Generating viral hook...</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#00E5FF', lineHeight: 1.5, minHeight: 54 }}>
        "{text}<span style={{ animation: 'blink 1s step-end infinite', borderRight: '2px solid #00E5FF', marginLeft: 2 }} />"
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {['Hook Score: 94', 'Niche: Finance', 'Platform: Reels'].map(tag => (
          <span key={tag} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#00C9A7', background: 'rgba(0,201,167,0.1)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(0,201,167,0.25)' }}>{tag}</span>
        ))}
      </div>
    </div>
  )
}

/* ── Mock Hook Score ─────────────────────────────────────────── */
function HookScoreDemo() {
  const [score] = useState(87)
  const [animate, setAnimate] = useState(false)
  useEffect(() => { setTimeout(() => setAnimate(true), 600) }, [])
  return (
    <div style={{ background: 'rgba(123,92,240,0.05)', border: '1px solid rgba(123,92,240,0.25)', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#7B5CF0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Hook Scorer</div>
      <div style={{ fontSize: '0.85rem', color: '#8BA4CC', marginBottom: 16, lineHeight: 1.5, fontStyle: 'italic' }}>"I made $10k in 30 days using this one trick nobody tells you about..."</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(123,92,240,0.15)" strokeWidth="6" />
            <circle cx="36" cy="36" r="28" fill="none" stroke="#7B5CF0" strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={animate ? `${2 * Math.PI * 28 * (1 - score / 100)}` : `${2 * Math.PI * 28}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{animate ? score : 0}</div>
        </div>
        <div style={{ flex: 1 }}>
          {[['Curiosity Gap', 95], ['Urgency', 82], ['Clarity', 78]].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: '0.68rem', color: '#6B8DB8', fontFamily: 'var(--font-mono)' }}>{l}</span>
                <span style={{ fontSize: '0.68rem', color: '#7B5CF0', fontWeight: 700 }}>{v}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(123,92,240,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: animate ? `${v}%` : '0%', background: 'linear-gradient(90deg,#7B5CF0,#A78BFA)', borderRadius: 99, transition: `width 1s ease ${0.2}s` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Mock Trending ───────────────────────────────────────────── */
function TrendingDemo() {
  const trends = [
    { cat: 'Finance', title: 'Zero to $10K Challenge', heat: 98 },
    { cat: 'Lifestyle', title: 'Morning Routine 2026', heat: 94 },
    { cat: 'Tech', title: 'AI Tools Nobody Talks About', heat: 91 },
  ]
  return (
    <div style={{ background: 'rgba(0,201,167,0.04)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#00C9A7', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>🔥 Trending Right Now</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {trends.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(0,201,167,0.06)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.1rem', color: '#00C9A7', width: 28, textAlign: 'center' }}>#{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E0F0FF' }}>{t.title}</div>
              <div style={{ fontSize: '0.66rem', color: '#00C9A7', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{t.cat}</div>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: t.heat > 95 ? '#FF5C5C' : '#FFD60A', fontFamily: 'var(--font-mono)' }}>{t.heat}🔥</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Demo Page ──────────────────────────────────────────── */
export default function Demo() {
  const navigate = useNavigate()
  const [featRef, featInView] = useInView()
  const [statsRef, statsInView] = useInView()
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100)
  }, [])

  const features = [
    { icon: '✦', title: 'AI Script Generator', desc: 'Generate viral-ready scripts for Reels, Shorts & TikTok in seconds. Tailored to your niche, platform, and language.', accent: '#00C8FF', delay: 0 },
    { icon: '◎', title: 'Hook Scorer', desc: 'Paste any hook and get an instant score with detailed breakdown — curiosity gap, urgency, clarity, and more.', accent: '#7B5CF0', delay: 0.1 },
    { icon: '📈', title: 'Trending Topics', desc: 'Real-time trends across niches with AI-generated script ideas. Never run out of content ideas again.', accent: '#00C9A7', delay: 0.2 },
    { icon: '🤖', title: 'Creator Advisor', desc: 'Your 24/7 content strategist. Ask anything about growth, scripts, strategy, and get expert-level answers instantly.', accent: '#FFD60A', delay: 0.3 },
    { icon: '◈', title: 'Performance Analyzer', desc: 'Paste your video link and get a deep analysis of what worked, what didn\'t, and exactly how to improve it.', accent: '#FF6EE7', delay: 0.4 },
    { icon: '📅', title: 'Content Calendar', desc: 'Plan and schedule your entire content month. Track streaks, stay consistent, never miss a posting day.', accent: '#00C8FF', delay: 0.5 },
    { icon: '🎨', title: 'Caption Generator', desc: 'Generate scroll-stopping captions with hashtags, emojis, and CTAs optimized for maximum engagement.', accent: '#00C9A7', delay: 0.6 },
    { icon: '🔄', title: 'Content Remixer', desc: 'Turn one piece of content into 5 formats instantly — Reels, carousels, tweets, LinkedIn posts, and more.', accent: '#7B5CF0', delay: 0.7 },
    { icon: '📚', title: 'Hook Library', desc: '500+ proven hooks across every niche. Filter by category, swipe what works, customize and make it yours.', accent: '#FF6EE7', delay: 0.8 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#06040E', overflowX: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* ── CSS ── */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes glow  { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        .demo-glow { animation: glow 3s ease infinite }
        .demo-float { animation: float 5s ease infinite }
      `}</style>

      {/* ── Background orbs ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div className="demo-glow" style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,255,0.12) 0%, transparent 70%)' }} />
        <div className="demo-glow" style={{ position: 'absolute', bottom: '10%', right: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,92,240,0.1) 0%, transparent 70%)', animationDelay: '1.5s' }} />
      </div>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 40px', background: 'rgba(6,4,14,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#00E5FF,#7B5CF0)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', boxShadow: '0 0 16px rgba(0,200,255,0.4)' }}>▶</div>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.1rem', background: 'linear-gradient(135deg,#00E5FF,#7B5CF0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.03em' }}>Nuove</span>
        </div>
        <button onClick={() => navigate('/auth')} style={{ background: 'linear-gradient(135deg,#00E5FF,#7B5CF0)', border: 'none', borderRadius: 10, padding: '9px 22px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 4px 16px rgba(0,200,255,0.35)' }}>
          Get Started Free →
        </button>
      </nav>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Hero ── */}
        <section style={{ textAlign: 'center', padding: 'clamp(60px,10vw,120px) 24px 80px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 99, padding: '6px 16px', marginBottom: 32, opacity: heroVisible ? 1 : 0, transition: 'opacity 0.8s ease 0.1s' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00C9A7', boxShadow: '0 0 8px #00C9A7' }} />
            <span style={{ fontSize: '0.75rem', color: '#00C9A7', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em' }}>AI-POWERED CONTENT STUDIO</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-head)', fontWeight: 900,
            fontSize: 'clamp(2.8rem,8vw,5.5rem)',
            letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24,
            opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
          }}>
            <span style={{ color: '#fff' }}>Go Viral.</span>{' '}
            <span style={{ background: 'linear-gradient(135deg,#00E5FF 0%,#00C8FF 40%,#7B5CF0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Every Time.</span>
          </h1>

          <p style={{ fontSize: 'clamp(1rem,2.5vw,1.25rem)', color: '#8BA4CC', lineHeight: 1.7, marginBottom: 40, maxWidth: 600, margin: '0 auto 40px', opacity: heroVisible ? 1 : 0, transition: 'opacity 0.8s ease 0.4s' }}>
            The AI content studio built for creators — generate viral scripts, score your hooks, analyze trends, and grow your audience 10x faster.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', opacity: heroVisible ? 1 : 0, transition: 'opacity 0.8s ease 0.5s' }}>
            <button onClick={() => navigate('/auth')} style={{ background: 'linear-gradient(135deg,#00E5FF,#00C8FF 50%,#7B5CF0)', border: 'none', borderRadius: 14, padding: '14px 32px', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 6px 32px rgba(0,200,255,0.45)', letterSpacing: '-0.01em' }}>
              Start for Free →
            </button>
            <button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 32px', color: '#8BA4CC', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              See Features ↓
            </button>
          </div>
        </section>

        {/* ── Live Demo Cards ── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
            <ScriptDemo />
            <HookScoreDemo />
            <TrendingDemo />
          </div>
        </section>


        {/* ── Features ── */}
        <section id="features" ref={featRef} style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#00C8FF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Everything You Need</div>
            <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: 'clamp(2rem,4vw,3rem)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              One Studio.<br />
              <span style={{ background: 'linear-gradient(135deg,#00E5FF,#7B5CF0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Infinite Content.</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
            {features.map((f, i) => <FeatureCard key={i} {...f} inView={featInView} />)}
          </div>
        </section>

        {/* ── Language Strip ── */}
        <section style={{ background: 'rgba(0,200,255,0.04)', borderTop: '1px solid rgba(0,200,255,0.1)', borderBottom: '1px solid rgba(0,200,255,0.1)', padding: '32px 24px', overflow: 'hidden' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#4A6A9A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Available in 11 Languages</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['English','Spanish','French','Portuguese','German','Arabic','Indonesian','Japanese','Korean','Hindi','Hinglish'].map(l => (
                <span key={l} style={{ fontSize: '0.8rem', color: '#8BA4CC', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '5px 14px' }}>{l}</span>
              ))}
            </div>
          </div>
        </section>


        {/* ── CTA ── */}
        <section style={{ textAlign: 'center', padding: '60px 24px 100px', maxWidth: 700, margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(0,200,255,0.07),rgba(123,92,240,0.07))', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 28, padding: '56px 40px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,200,255,0.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,92,240,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#fff', letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.1 }}>
                Your Next Viral Video<br />Starts Here.
              </h2>
              <p style={{ color: '#8BA4CC', fontSize: '0.95rem', marginBottom: 32, lineHeight: 1.6 }}>
                Generate viral scripts, score your hooks, and grow with data — all in one place.
              </p>
              <button onClick={() => navigate('/auth')} style={{ background: 'linear-gradient(135deg,#00E5FF,#00C8FF 50%,#7B5CF0)', border: 'none', borderRadius: 14, padding: '16px 40px', color: '#fff', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 8px 36px rgba(0,200,255,0.45)', letterSpacing: '-0.01em' }}>
                Start Creating for Free →
              </button>
              <div style={{ marginTop: 16, fontSize: '0.75rem', color: '#4A6A9A', fontFamily: 'var(--font-mono)' }}>No credit card required · Free plan available</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
