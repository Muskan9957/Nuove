import { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import { MicButton } from '../components/VoiceAssistant'
import { usePrefs } from '../hooks/usePrefs'
import { useLang } from '../i18n.jsx'

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '12px 16px' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginRight: 4 }}>Creator Advisor</span>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'inline-block',
            animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 700, color: '#fff',
          flexShrink: 0, marginRight: 8, marginTop: 2,
          boxShadow: '0 0 10px rgba(0,200,255,0.3)',
        }}>AI</div>
      )}
      <div style={{
        maxWidth: '72%',
        background: isUser ? 'var(--accent)' : 'var(--surface2)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
        padding: '12px 16px',
      }}>
        {!isUser && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Creator Advisor
          </div>
        )}
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.65, color: isUser ? '#fff' : 'var(--text)', whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </p>
      </div>
    </div>
  )
}

export default function Coach() {
  const { t, lang } = useLang()
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef   = useRef(null)
  const { niches, goals, platform, aiContext } = usePrefs()

  // Scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Load history on mount
  useEffect(() => {
    api.getCoachHistory()
      .then(data => {
        const msgs = Array.isArray(data) ? data : (data?.messages || [])
        if (msgs.length > 0) {
          setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true))
  }, [])

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || loading) return

    const userMsg = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Keep last 10 messages for context
    const historyForApi = newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    try {
      const data = await api.coachChat({ message: trimmed, history: historyForApi.slice(0, -1), context: aiContext, language: lang })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I ran into an issue. Please try again. (${err.message})`,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0 && historyLoaded

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <h1 className="page-title">{t('nav_coach')}</h1>
        <p className="page-sub">{t('coach_sub')}</p>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Messages scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', minHeight: 0 }}>
          {/* Empty state with starter questions */}
          {isEmpty && (() => {
            const primaryNiche = niches?.[0] || ''
            const nicheLabel = primaryNiche ? primaryNiche.charAt(0).toUpperCase() + primaryNiche.slice(1) : ''
            // Niche-specific starter questions when niche is set
            const nicheQuestions = nicheLabel ? [
              `What type of ${nicheLabel} content is going viral right now?`,
              `Give me 5 hook ideas for my ${nicheLabel} audience`,
              `What posting schedule works best for ${nicheLabel} creators?`,
              `How do I stand out in the ${nicheLabel} niche?`,
            ] : [t('coach_q1'), t('coach_q2'), t('coach_q3'), t('coach_q4')]

            return (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div>
                {nicheLabel ? (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ color: 'var(--text)', fontSize: '0.92rem', fontWeight: 600, marginBottom: 4 }}>
                      I'm set up for your <span style={{ color: 'var(--accent)' }}>{nicheLabel}</span> content
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Ask me anything — scripts, growth tactics, hook ideas, strategy
                    </p>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
                    {t('coach_empty')}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420, margin: '0 auto' }}>
                  {nicheQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      style={{
                        padding: '10px 16px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.color = 'var(--text)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.color = 'var(--text-muted)'
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Loading skeleton while history loads */}
          {!historyLoaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.4 }}>
              {[80, 55, 120, 40].map((w, i) => (
                <div key={i} style={{
                  height: 36, borderRadius: 10,
                  background: 'var(--surface2)',
                  width: `${w}%`,
                  alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
                }} />
              ))}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '4px 16px 16px 16px',
              }}>
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            className="input"
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              resize: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              paddingTop: 10,
              paddingBottom: 10,
            }}
            placeholder={t('coach_placeholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          <MicButton onResult={text => sendMessage(text)} />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: input.trim() ? 'var(--gradient)' : 'var(--surface2)',
              border: 'none',
              color: input.trim() ? '#fff' : 'var(--text-faint)',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'all 0.18s',
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
