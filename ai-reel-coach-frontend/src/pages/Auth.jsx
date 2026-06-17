import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../store'
import { useToast } from '../components/Toast'
import { api } from '../api'
import Logo from '../components/Logo'
import PasswordChecklist, { isPasswordValid } from '../components/PasswordChecklist'

// Known webmail providers → direct inbox link (so the user can jump to their mail)
const PROVIDER_URLS = {
  'gmail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'googlemail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'outlook.com': 'https://outlook.live.com/mail/0/',
  'hotmail.com': 'https://outlook.live.com/mail/0/',
  'live.com': 'https://outlook.live.com/mail/0/',
  'yahoo.com': 'https://mail.yahoo.com/',
  'icloud.com': 'https://www.icloud.com/mail',
  'me.com': 'https://www.icloud.com/mail',
  'proton.me': 'https://mail.proton.me/u/0/inbox',
  'protonmail.com': 'https://mail.proton.me/u/0/inbox',
}
const inboxUrlFor = (email) => PROVIDER_URLS[(email.split('@')[1] || '').toLowerCase()] || null

/* ─── SVG Icons ──────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
)

const YouTubeIcon = () => (
  <svg width="20" height="14" viewBox="0 0 24 17" fill="white" aria-hidden="true">
    <path d="M23.495 2.205a3.02 3.02 0 0 0-2.122-2.136C19.548 0 12 0 12 0S4.452 0 2.627.069a3.02 3.02 0 0 0-2.122 2.136C0 4.04 0 8.667 0 8.667s0 4.627.505 6.462a3.02 3.02 0 0 0 2.122 2.136C4.452 17.334 12 17.334 12 17.334s7.548 0 9.373-.069a3.02 3.02 0 0 0 2.122-2.136C24 13.294 24 8.667 24 8.667s0-4.627-.505-6.462zM9.545 12.001V5.333l6.273 3.334-6.273 3.334z"/>
  </svg>
)

/* ─── Auth ───────────────────────────────────────────────────────── */
export default function Auth() {
  const [mode, setMode]             = useState('login')
  const [email, setEmail]           = useState('')
  const [password, setPass]         = useState('')
  const [name, setName]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const [verifySent, setVerifySent] = useState(false)
  const { login, register }         = useAuth()
  const toast                       = useToast()
  const navigate                    = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        toast('Welcome back!', 'success')
        navigate('/dashboard')
      } else {
        await register(email, password, name)
        setVerifySent(true)
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialClick = (platform) => {
    const base = import.meta.env.VITE_API_URL || ''
    window.location.href = `${base}/api/auth/${platform}`
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle ambient glow — keeps background alive without competing */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,45,139,0.07) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }} className="page-enter">

        {/* Email verification sent screen */}
        {verifySent && (
          <div style={{ background: 'var(--surface-card)', backdropFilter: 'blur(24px)', border: '1px solid var(--border-bright)', borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📬</div>
            <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', marginBottom: 8 }}>
              Check your inbox
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 24 }}>
              We've sent a verification link to <strong style={{ color: 'var(--text)' }}>{email}</strong>. Click it to verify your account and get started.
            </p>

            {inboxUrlFor(email) && (
              <a href={inboxUrlFor(email)} target="_blank" rel="noopener noreferrer"
                 className="btn btn-primary btn-full"
                 style={{ display: 'block', marginBottom: 14, textDecoration: 'none' }}>
                Open your email →
              </a>
            )}

            <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>
              Didn't get it? Check your spam folder.
            </p>
            <button onClick={() => { setVerifySent(false); setMode('login') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', marginTop: 16, fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}>
              Back to sign in
            </button>
          </div>
        )}

        {!verifySent && (
          <>
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <Logo size={42} showWordmark />
            </div>

        {/* Auth card */}
        <div style={{
          background: 'var(--surface-card)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-bright)',
          borderRadius: 20,
          padding: '32px',
          boxShadow: 'var(--shadow-glass)',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-head)', fontWeight: 800,
            fontSize: '1.6rem', letterSpacing: '-0.03em',
            color: 'var(--text)', marginBottom: 4, lineHeight: 1.2,
          }}>
            {mode === 'login' ? 'Welcome back' : 'Get started free'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>
            {mode === 'login' ? 'Sign in to your Nuove studio' : 'No credit card required'}
          </p>

          {/* Social buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
            {[
              { id: 'google',    label: 'Continue with Google',     icon: <GoogleIcon />,    bg: '#fff',                                                            color: '#1f1f1f', border: '1px solid rgba(0,0,0,0.15)', soon: false },
              { id: 'instagram', label: 'Continue with Instagram',  icon: <InstagramIcon />, bg: 'linear-gradient(45deg, #405DE6, #833AB4, #C13584, #E1306C)',     color: '#fff',    border: 'none',                       soon: true  },
              { id: 'youtube',   label: 'Continue with YouTube',    icon: <YouTubeIcon />,   bg: '#FF0000',                                                         color: '#fff',    border: 'none',                       soon: true  },
            ].map(btn => (
              <button
                key={btn.id}
                type="button"
                disabled={btn.soon}
                onClick={() => !btn.soon && handleSocialClick(btn.id)}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', height: 44, padding: '0 16px',
                  borderRadius: 10, cursor: btn.soon ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                  fontWeight: 600, transition: 'opacity 0.15s, transform 0.15s',
                  background: btn.bg, color: btn.color, border: btn.border || 'none',
                  opacity: btn.soon ? 0.38 : 1,
                  filter: btn.soon ? 'grayscale(0.4)' : 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, flexShrink: 0 }}>{btn.icon}</span>
                <span style={{ flex: 1, textAlign: 'center' }}>{btn.label}</span>
                {btn.soon && (
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em',
                    padding: '2px 7px', borderRadius: 99,
                    background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.8)',
                    textTransform: 'uppercase', flexShrink: 0,
                  }}>
                    Coming Soon
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div className="field">
                <label>Name</label>
                <input className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Password</label>
                {mode === 'login' && (
                  <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                    Forgot password?
                  </Link>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Create a strong password' : '••••••••'}
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-faint)', padding: 4, display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {mode === 'register' && <PasswordChecklist password={password} />}
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || (mode === 'register' && !isPasswordValid(password))}
              style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700, letterSpacing: '0.01em' }}
            >
              {loading
                ? <><span className="spinner" /> Processing...</>
                : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 18 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-body)', padding: 0 }}
            >
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
