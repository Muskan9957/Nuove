import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../store'
import Logo from '../components/Logo'
import PasswordChecklist, { isPasswordValid } from '../components/PasswordChecklist'

export default function ResetPassword() {
  const [searchParams]      = useSearchParams()
  const navigate            = useNavigate()
  const { login: setUser }  = useAuth()
  const token               = searchParams.get('token')

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')
  const [showPw, setShowPw]       = useState(false)

  useEffect(() => {
    if (!token) navigate('/forgot-password')
  }, [token])

  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8)  s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', '#ff6b6b', '#FF9933', '#FFD60A', '#00C9A7'][strength]

  const submit = async e => {
    e.preventDefault()
    if (!isPasswordValid(password)) { setError('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      const data = await api.resetPassword({ token, password })
      // Auto-login after reset
      if (data.token) {
        localStorage.setItem('arc_token', data.token)
      }
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch (err) {
      setError(err.message || 'Reset link is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={s.root}>
      <div style={{ ...s.card, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <h1 style={s.title}>Password updated!</h1>
        <p style={s.sub}>You're being signed in automatically…</p>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, animation: 'doneLoad 2.2s ease forwards' }} />
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={{ marginBottom: 28 }}>
          <Logo size={36} />
        </div>

        <h1 style={s.title}>Set a new password</h1>
        <p style={s.sub}>Make it strong — you won't need to reset it again.</p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
          {/* New password */}
          <div className="field">
            <label>New password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.85rem' }}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {/* Strength bar */}
            {password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 99,
                      background: i <= strength ? strengthColor : 'var(--surface3)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span>
              </div>
            )}
            <PasswordChecklist password={password} />
          </div>

          {/* Confirm password */}
          <div className="field">
            <label>Confirm password</label>
            <input
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{
                borderColor: confirm && confirm !== password ? 'rgba(255,70,70,0.5)' : undefined
              }}
            />
            {confirm && confirm !== password && (
              <span style={{ fontSize: '0.78rem', color: '#ff6b6b', marginTop: 4 }}>Passwords don't match</span>
            )}
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,70,70,0.1)', border: '1px solid rgba(255,70,70,0.3)',
              borderRadius: 10, padding: '10px 14px', color: '#ff6b6b', fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || !isPasswordValid(password) || password !== confirm}
            style={{ marginTop: 4 }}
          >
            {loading ? <span className="spinner" /> : 'Update password →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/auth" style={s.link}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 20px',
  },
  card: {
    width: '100%', maxWidth: 420,
    background: 'var(--surface-card)',
    backdropFilter: 'blur(24px)',
    border: '1px solid var(--border-bright)',
    borderRadius: 24,
    padding: '40px 36px',
    boxShadow: 'var(--shadow-glass)',
  },
  title: {
    fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 800,
    letterSpacing: '-0.03em', color: 'var(--text)', margin: '0 0 8px',
  },
  sub:  { color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 },
  link: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-body)', textDecoration: 'none', fontWeight: 600 },
  progressBar: { height: 4, background: 'var(--surface2)', borderRadius: 99, marginTop: 20, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#00C8FF,#7B5CF0)', borderRadius: 99 },
}
