import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import Logo from '../components/Logo'

export default function VerifyEmail() {
  const [status, setStatus]   = useState('verifying') // verifying | success | error
  const [message, setMessage] = useState('')
  const [searchParams]        = useSearchParams()
  const { refreshUser }       = useAuth()
  const navigate              = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setStatus('error'); setMessage('No verification token found.'); return }

    api.verifyEmail(token)
      .then(async data => {
        // Store token AND populate the auth context, otherwise protected
        // routes (onboarding/dashboard) see no user and bounce to login.
        localStorage.setItem('arc_token', data.token)
        localStorage.removeItem('vs_onboarded')
        await refreshUser()
        setStatus('success')
        setTimeout(() => navigate('/onboarding'), 1500)
      })
      .catch(err => {
        setStatus('error')
        setMessage(err.message || 'Verification failed. The link may have expired.')
      })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size={42} showWordmark />
        </div>

        <div style={{
          background: 'var(--surface-card)', backdropFilter: 'blur(24px)',
          border: '1px solid var(--border-bright)', borderRadius: 20, padding: '40px 32px',
        }}>
          {status === 'verifying' && (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⏳</div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Verifying your email...</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Just a moment.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Email verified!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Welcome to Nuove. Taking you to setup...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>❌</div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Verification failed</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>{message}</p>
              <button onClick={() => navigate('/auth')} className="btn btn-primary btn-full">Back to Sign In</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
