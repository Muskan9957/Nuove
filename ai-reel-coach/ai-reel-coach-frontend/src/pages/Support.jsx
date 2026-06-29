import { useState } from 'react'
import { api } from '../api'
import { useToast } from '../components/Toast'

export default function Support() {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!feedback.trim()) return

    setSubmitting(true)
    try {
      await api.submitSupport(feedback)
      toast('Feedback submitted successfully! We will get back to you soon.', 'success')
      setFeedback('')
    } catch (err) {
      toast(err.message || 'Could not submit feedback. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-fade-in" style={{ padding: '0 20px', maxWidth: 640, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center', marginTop: 24 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>💬</div>
        <h1 style={{ 
          fontFamily: 'var(--font-head)', 
          fontSize: '2rem', 
          fontWeight: 800, 
          letterSpacing: '-0.03em', 
          color: 'var(--text)',
          marginBottom: 8 
        }}>
          Support & Feedback
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Have a question, feature request, or found a bug? Let us know.
        </p>
      </div>

      {/* Feedback Form */}
      <div style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 24,
        boxShadow: 'var(--shadow)'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              color: 'var(--text)', 
              marginBottom: 8 
            }}>
              How can we help you today?
            </label>
            <textarea
              placeholder="Describe your issue or share your ideas..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              style={{
                width: '100%',
                minHeight: 140,
                padding: '16px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '0.95rem',
                resize: 'vertical',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button
            type="submit"
            disabled={!feedback.trim() || submitting}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #00C8FF, #A06EFF)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: (!feedback.trim() || submitting) ? 'not-allowed' : 'pointer',
              opacity: (!feedback.trim() || submitting) ? 0.6 : 1,
              transition: 'opacity 0.2s, transform 0.2s',
            }}
          >
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>

      {/* Direct Email Option */}
      <div style={{ 
        marginTop: 32, 
        textAlign: 'center', 
        padding: 24,
        background: 'var(--surface)',
        borderRadius: 20,
        border: '1px solid var(--border)'
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>✉️</div>
        <h3 style={{ 
          fontSize: '1rem', 
          fontWeight: 700, 
          color: 'var(--text)', 
          marginBottom: 8 
        }}>
          Prefer Email?
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
          You can also reach out to our team directly via email for any urgent concerns.
        </p>
        <a 
          href="mailto:support.nuove@anahatone.com" 
          style={{
            display: 'inline-block',
            padding: '8px 24px',
            background: 'var(--surface2)',
            color: 'var(--text)',
            borderRadius: 99,
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid var(--border)',
            transition: 'background 0.2s'
          }}
        >
          support.nuove@anahatone.com
        </a>
      </div>

    </div>
  )
}
