import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import { useToast } from '../components/Toast'
import Logo from '../components/Logo'

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    tagline:  'Try Nuove, no card needed',
    priceM:   0,
    priceY:   0,
    badge:    null,
    accent:   '#6B7280',
    accentBg: 'rgba(107,114,128,0.10)',
    cta:      'Get started free',
    ctaStyle: 'ghost',
    features: [
      { text: '5 AI scripts / month',              ok: true  },
      { text: '5 hook scores / month',             ok: true  },
      { text: 'Scripts library',                   ok: true  },
      { text: 'Hook Library (browse)',             ok: true  },
      { text: 'General daily brief',               ok: true  },
      { text: 'Niche-personalised brief',          ok: false },
      { text: 'Caption Generator',                 ok: false },
      { text: 'Teleprompter & Recorder',           ok: false },
      { text: 'Performance Analytics',             ok: false },
      { text: 'Content Calendar',                  ok: false },
      { text: 'Creator Coach (AI chat)',            ok: false },
      { text: 'My Voice ,  Creator DNA',            ok: false },
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    tagline:  'Everything a creator needs',
    priceM:   99,
    priceY:   74,
    badge:    'Most Popular',
    accent:   '#FF8C00',
    accentBg: 'rgba(255,140,0,0.10)',
    cta:      'Start Pro',
    ctaStyle: 'primary',
    features: [
      { text: 'Unlimited AI scripts',              ok: true  },
      { text: 'Unlimited hook scores',             ok: true  },
      { text: 'Niche-personalised daily brief',    ok: true  },
      { text: 'Caption Generator (unlimited)',     ok: true  },
      { text: 'Teleprompter & Recorder',           ok: true  },
      { text: 'Reel Ready (captions + songs)',     ok: true  },
      { text: 'Trending Topics (live)',            ok: true  },
      { text: 'Script Templates',                  ok: true  },
      { text: 'Performance Analytics',             ok: true  },
      { text: 'Content Calendar',                  ok: true  },
      { text: 'Creator Coach (unlimited chat)',    ok: true  },
      { text: 'My Voice ,  Creator DNA',            ok: false },
    ],
  },
  {
    id:       'studio',
    name:     'Studio',
    tagline:  'For power creators & brands',
    priceM:   499,
    priceY:   374,
    badge:    'Best Value',
    accent:   '#FF2D6F',
    accentBg: 'rgba(255,45,111,0.10)',
    cta:      'Start Studio',
    ctaStyle: 'gradient',
    features: [
      { text: 'Everything in Pro',                 ok: true  },
      { text: 'My Voice ,  Creator DNA',            ok: true  },
      { text: 'Content Remix (all platforms)',     ok: true  },
      { text: 'Priority AI (2× faster)',           ok: true  },
      { text: 'Advanced performance reports',      ok: true  },
      { text: 'Creator Score insights',            ok: true  },
      { text: 'Script retakes & refinements',      ok: true  },
      { text: 'Full Hook Library + Templates',     ok: true  },
      { text: 'Early access to new features',      ok: true  },
      { text: 'Dedicated support',                 ok: true  },
    ],
  },
]

const FAQS = [
  {
    q: 'Do I need a credit card to start?',
    a: 'Nope! The Free plan is genuinely free with no strings attached. Just sign up with your email or Google account and you can start writing scripts right away. Your card details only come into play when you decide you want to upgrade.',
  },
  {
    q: 'What happens when I hit the free plan limit?',
    a: 'You get 5 scripts and 5 hook scores every month on the free plan. Once you reach that, the app will let you know and give you the option to upgrade. Nothing gets deleted and your whole script library stays safe. Think of it like a soft pause, not a hard stop.',
  },
  {
    q: 'Who owns the content I create with Nuove?',
    a: 'You own it, full stop. Every script, caption, and hook you generate is yours to use however you like. We do not claim any rights over your work and we never use your content for training models or share it with third parties.',
  },
  {
    q: "What's the actual difference between Pro and Studio?",
    a: 'Pro covers everything a solo creator needs day to day: unlimited scripts, your personalised daily brief, captions, the teleprompter, analytics, content calendar, and the creator coach. Studio goes further for power creators and brand accounts. On top of everything in Pro, you get Creator DNA (which learns your writing style), Content Remix for every platform, faster AI generation, deeper performance reports, and first access to new features before anyone else.',
  },
  {
    q: 'Can I switch plans or cancel anytime?',
    a: 'Yes, always. You can upgrade, downgrade, or cancel from your Profile page whenever you want. No phone calls, no annoying forms. If you upgrade, it kicks in straight away. If you downgrade or cancel, you keep your current plan until the billing period is up and then it steps down automatically.',
  },
  {
    q: 'Does Nuove support Hindi, Hinglish, and regional languages?',
    a: 'Absolutely. Just pick your preferred language in Settings before you generate and the AI will write in that language naturally. It is not just a translation of English output either. The AI is trained on real Indian creator content so it actually understands how Hinglish works, the rhythm of it, the way people actually speak.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We use Razorpay for payments so you can pay with pretty much anything: UPI (GPay, PhonePe, Paytm), all major credit and debit cards (Visa, Mastercard, RuPay), net banking, or EMI. Everything goes through Razorpay\'s secure checkout so your payment details are never stored on our end.',
  },
  {
    q: "I'm stuck or something isn't working. How do I get help?",
    a: 'Hit the feedback button inside the app or drop us an email at support@nuove.in and we will get back to you. Pro users get priority support with a response within 24 hours. If you are on Studio, you get dedicated support and we aim to respond within 4 hours during business hours. We genuinely read every message.',
  },
]

// ─── Load Razorpay script dynamically ─────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Pricing() {
  const [annual, setAnnual]           = useState(false)
  const [openFaq, setOpenFaq]         = useState(null)
  const [checkingOut, setCheckingOut] = useState(null)
  const { user, refreshUser }         = useAuth()
  const navigate                      = useNavigate()
  const toast                         = useToast()

  const handleCta = async (plan) => {
    if (!user) return navigate('/auth')
    if (plan.id === 'free') return navigate('/dashboard')

    try {
      setCheckingOut(plan.id)

      // 1. Ask backend to create a Razorpay subscription
      const billing = annual ? 'annual' : 'monthly'
      const data = await api.createCheckout(plan.id.toUpperCase(), billing)

      // If not configured yet, show friendly message
      if (!data?.subscriptionId) {
        toast('Payments launching soon ,  we\'ll notify you! 🚀', 'success')
        return
      }

      // 2. Load Razorpay checkout.js
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        toast('Could not load payment gateway. Check your connection.', 'error')
        return
      }

      // 3. Open Razorpay modal
      const options = {
        key             : data.keyId,
        subscription_id : data.subscriptionId,
        name            : 'Nuove',
        description     : `${plan.name} Plan ,  ₹${plan.priceM}/month`,
        image           : '/logo.png',
        prefill         : {
          email : data.userEmail || user?.email || '',
          name  : data.userName  || user?.name  || '',
        },
        theme           : { color: '#00C8FF' },
        modal           : {
          ondismiss: () => {
            setCheckingOut(null)
            toast('Payment cancelled.', 'error')
          },
        },
        handler: async (response) => {
          try {
            // 4. Verify payment signature on backend
            const verified = await api.verifyPayment({
              paymentId      : response.razorpay_payment_id,
              subscriptionId : response.razorpay_subscription_id,
              signature      : response.razorpay_signature,
              plan           : plan.id.toUpperCase(),
              billing,
            })
            if (verified.success) {
              // Refresh user object in global store so plan badge updates immediately
              await refreshUser()
              toast(`🎉 Welcome to ${plan.name}! Your plan is now active.`, 'success')
              setTimeout(() => navigate('/dashboard'), 1500)
            }
          } catch {
            toast('Payment received but verification failed ,  contact support.', 'error')
          } finally {
            setCheckingOut(null)
          }
        },
      }

      new window.Razorpay(options).open()

    } catch (err) {
      if (err.message?.includes('not configured')) {
        toast('Payments are being set up ,  stay tuned! 🚀', 'success')
      } else {
        toast(err.message || 'Something went wrong.', 'error')
      }
      setCheckingOut(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 20px 80px' }}>

      {/* Nav */}
      <div style={{
        maxWidth: 1080, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 0',
      }}>
        <button onClick={() => navigate(user ? '/dashboard' : '/')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <Logo size={36} />
        </button>
        {user ? (
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm">
            ← Dashboard
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/auth')} className="btn btn-ghost btn-sm">Sign in</button>
            <button onClick={() => navigate('/auth')} className="btn btn-primary btn-sm">Get started free</button>
          </div>
        )}
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 56px', padding: '20px 0' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--accent-dim)',
          border: '1px solid var(--border-bright)',
          borderRadius: 99,
          padding: '5px 14px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          🌍 Creator-First Pricing
        </div>

        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          color: 'var(--text)',
          marginBottom: 16,
        }}>
          Invest in your{' '}
          <span style={{
            background: 'linear-gradient(135deg, #FF8C00, #FF2D6F)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            viral growth
          </span>
        </h1>

        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 32 }}>
          Every plan comes with a 7-day free trial. No credit card required.
        </p>

        {/* Toggle */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 99,
          padding: '5px',
        }}>
          <button
            onClick={() => setAnnual(false)}
            style={{
              padding: '8px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
              background: !annual ? 'var(--surface3)' : 'transparent',
              color: !annual ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '0.875rem', fontWeight: 600,
              fontFamily: 'var(--font-body)',
              transition: 'all 0.2s ease',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
              background: annual ? 'var(--gradient)' : 'transparent',
              color: annual ? '#fff' : 'var(--text-muted)',
              fontSize: '0.875rem', fontWeight: 600,
              fontFamily: 'var(--font-body)',
              transition: 'all 0.2s ease',
            }}
          >
            Annual
            <span style={{
              background: annual ? 'rgba(255,255,255,0.2)' : 'var(--accent-dim)',
              color: annual ? '#fff' : 'var(--accent)',
              fontSize: '0.65rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
              padding: '2px 7px', borderRadius: 99,
              letterSpacing: '0.05em',
            }}>
              −25%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{
        maxWidth: 1040,
        margin: '0 auto 72px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        alignItems: 'start',
      }}>
        {PLANS.map((plan, i) => {
          const price = annual ? plan.priceY : plan.priceM
          const isPopular = plan.id === 'pro'
          return (
            <div
              key={plan.id}
              style={{
                background: isPopular
                  ? 'linear-gradient(180deg, rgba(255,140,0,0.09) 0%, var(--surface-card) 40%)'
                  : 'var(--surface-card)',
                backdropFilter: 'blur(20px)',
                border: isPopular
                  ? '1.5px solid rgba(255,140,0,0.38)'
                  : '1px solid var(--border)',
                borderRadius: 24,
                padding: isPopular ? '32px 28px' : '28px 24px',
                position: 'relative',
                boxShadow: isPopular ? 'var(--shadow-accent), var(--shadow-glass)' : 'var(--shadow)',
                transform: isPopular ? 'translateY(-8px)' : 'none',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                animation: `fadeUp 0.4s ease ${i * 0.1}s both`,
              }}
              onMouseEnter={e => { if (!isPopular) e.currentTarget.style.transform = 'translateY(-4px)' }}
              onMouseLeave={e => { if (!isPopular) e.currentTarget.style.transform = 'none' }}
            >
              {/* Badge */}
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: isPopular
                    ? 'linear-gradient(135deg, #FF8C00, #FF2D6F)'
                    : 'linear-gradient(135deg, #FF2D6F, #B36DFF)',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 14px',
                  borderRadius: 99,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(255,95,31,0.4)',
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: plan.accentBg,
                  borderRadius: 8,
                  padding: '5px 12px',
                  marginBottom: 12,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: plan.accent }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: plan.accent, fontFamily: 'var(--font-mono)' }}>
                    {plan.name}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>{plan.tagline}</p>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 500 }}>₹</span>
                  <span style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: price === 0 ? '2.6rem' : '2.6rem',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    color: 'var(--text)',
                  }}>
                    {price === 0 ? '0' : price.toLocaleString('en-IN')}
                  </span>
                  {price > 0 && (
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>/ mo</span>
                  )}
                </div>
                {annual && price > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 3 }}>
                    Billed ₹{(plan.priceY * 12).toLocaleString('en-IN')}/year &nbsp;
                    <span style={{ color: '#22C55E', fontWeight: 600 }}>
                      save ₹{((plan.priceM - plan.priceY) * 12).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleCta(plan)}
                disabled={checkingOut === plan.id}
                style={{ opacity: checkingOut && checkingOut !== plan.id ? 0.6 : 1,
                  width: '100%',
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  marginBottom: 24,
                  transition: 'all 0.2s ease',
                  ...(plan.ctaStyle === 'primary' ? {
                    background: 'linear-gradient(135deg, #FF8C00, #FF2D6F)',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(255,140,0,0.40)',
                  } : plan.ctaStyle === 'gradient' ? {
                    background: 'linear-gradient(135deg, #FF2D6F, #B36DFF)',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(255,45,111,0.32)',
                  } : {
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }),
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none' }}
              >
                {checkingOut === plan.id ? 'Redirecting…' : plan.cta}
              </button>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

              {/* Features */}
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    opacity: f.ok ? 1 : 0.35,
                  }}>
                    <div style={{
                      width: 18, height: 18,
                      borderRadius: '50%',
                      background: f.ok
                        ? (isPopular ? 'rgba(255,140,0,0.18)' : 'rgba(107,140,192,0.15)')
                        : 'var(--surface2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {f.ok ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke={isPopular ? '#FF8C00' : '#A07060'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2 2l4 4M6 2L2 6" stroke="#3A3A5C" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.84rem',
                      color: f.ok ? 'var(--text-muted)' : 'var(--text-faint)',
                      lineHeight: 1.4,
                    }}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>


      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto 72px' }}>
        <h2 style={{
          fontFamily: 'var(--font-head)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
          textAlign: 'center',
          marginBottom: 32,
        }}>
          Questions? Answered.
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
                borderColor: openFaq === i ? 'var(--border-bright)' : 'var(--border)',
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', padding: '18px 20px',
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{f.q}</span>
                <span style={{
                  color: openFaq === i ? 'var(--accent)' : 'var(--text-faint)',
                  fontSize: '1.2rem',
                  transform: openFaq === i ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.2s ease, color 0.2s ease',
                  lineHeight: 1,
                  flexShrink: 0,
                }}>
                  +
                </span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 20px 18px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.7 }}>{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        maxWidth: 600, margin: '0 auto',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255,140,0,0.08), rgba(255,45,111,0.06))',
        border: '1px solid var(--border-bright)',
        borderRadius: 28,
        padding: '48px 32px',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🚀</div>
        <h2 style={{
          fontFamily: 'var(--font-head)',
          fontSize: '1.8rem',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: 'var(--text)',
          marginBottom: 10,
        }}>
          Ready to go viral?
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.9rem' }}>
          Take your first step to effortless content creation. Start with the free plan, no credit card needed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(user ? '/dashboard' : '/auth')}
            className="btn btn-primary btn-lg"
          >
            Start for free →
          </button>
          <button
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
            }}
            className="btn btn-ghost btn-lg"
          >
            See Pro features
          </button>
        </div>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginTop: 16 }}>
          🌍 Made for creators worldwide &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; Multi-language support
        </p>
      </div>
    </div>
  )
}

