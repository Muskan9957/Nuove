import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store'
import { useLang } from '../i18n.jsx'
import LanguageSelector from './LanguageSelector'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'

/* ─── useIsMobile hook ───────────────────────────────────────────── */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return isMobile
}

/* ─── SVG Nav Icons ──────────────────────────────────────────────── */
const IconDashboard = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
  </svg>
)

const IconGenerate = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
)

const IconScripts = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)

const IconScore = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 3"/>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
  </svg>
)

const IconPerformance = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const CalendarIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const TrendIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
)

const TemplateIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const CaptionIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <line x1="6" y1="10" x2="14" y2="10"/>
    <line x1="6" y1="14" x2="18" y2="14"/>
  </svg>
)

const RemixIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)

const CoachIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="9" y1="10" x2="15" y2="10"/>
  </svg>
)

const ReelReadyIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="14" rx="2"/>
    <path d="M7 2l3 4M17 2l-3 4"/>
    <path d="M10 13l4-2-4-2v4z" fill="currentColor" stroke="none"/>
  </svg>
)

const RecordIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
  </svg>
)

const IconLogout = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const ReelLogoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* V / Wings */}
    <path d="M5 34 L13 19 L19 27 L25 19 L33 34"
      fill="none" stroke="white" strokeWidth="2.8"
      strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
    {/* Rocket body */}
    <path d="M18 27 L27 9 L37 9 L37 19 Z" fill="white" opacity="0.9"/>
    {/* Rocket tip cyan */}
    <path d="M31 9 L37 9 L37 15 Z" fill="rgba(0,229,255,0.9)"/>
    {/* Lightning bolt */}
    <path d="M31 10 L26 20 L30 20 L25 30"
      stroke="rgba(0,229,255,1)" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round"/>
    {/* Node */}
    <circle cx="33" cy="13" r="2.2" fill="rgba(0,229,255,0.95)"/>
  </svg>
)

/* ─── Nav config with sections ───────────────────────────────────── */
const NAV_CONFIG = [
  { section: 'Studio',   sectionClass: 'nav-section-studio'   },
  { to: '/dashboard',   icon: IconDashboard,   labelKey: 'nav_dashboard'   },
  { to: '/generate',    icon: IconGenerate,    labelKey: 'nav_generate'    },
  { to: '/scripts',     icon: IconScripts,     labelKey: 'nav_scripts'     },
  { to: '/coach',       icon: CoachIcon,       labelKey: 'nav_coach'       },
  { to: '/record',      icon: RecordIcon,      labelKey: 'nav_record'     },
  { section: 'Content',  sectionClass: 'nav-section-content'  },
  { to: '/captions',    icon: CaptionIcon,     labelKey: 'nav_captions'    },
  { to: '/crosspost',   icon: RemixIcon,       labelKey: 'nav_remix'       },
  { to: '/templates',   icon: TemplateIcon,    labelKey: 'nav_templates'   },
  { section: 'Insights', sectionClass: 'nav-section-insights' },
  { to: '/trending',    icon: TrendIcon,       labelKey: 'nav_trending'    },
  { to: '/performance', icon: IconPerformance, labelKey: 'nav_performance' },
  { to: '/calendar',    icon: CalendarIcon,    labelKey: 'nav_calendar'    },
]

// Bottom nav: top 4 core items + Coach (most important for retention)
const MOBILE_NAV_CONFIG = [
  { to: '/dashboard',   icon: IconDashboard,   labelKey: 'nav_dashboard' },
  { to: '/generate',    icon: IconGenerate,    labelKey: 'nav_generate'  },
  { to: '/coach',       icon: CoachIcon,       labelKey: 'nav_coach'     },
  { to: '/captions',    icon: CaptionIcon,     labelKey: 'nav_captions'  },
]

const planColors = { FREE: '#4A5C8A', STARTER: '#00C9A7', PRO: '#00C8FF' }

/* ─── Layout Component ───────────────────────────────────────────── */
export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { t }            = useLang()
  const navigate         = useNavigate()
  const isMobile         = useIsMobile()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }
  const location     = useLocation()

  const userInitial  = (user?.name || user?.email || 'U').charAt(0).toUpperCase()
  const userName     = user?.name || user?.email?.split('@')[0] || 'Creator'
  const planColor    = planColors[user?.plan] || planColors.FREE

  return (
    <div style={styles.root}>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      {!isMobile && (
        <aside style={styles.sidebar} className="app-sidebar">
          {/* Logo */}
          <div style={styles.logoWrap}>
            <Logo size={36} showWordmark />
          </div>

          {/* Navigation */}
          <nav style={styles.nav}>
            {NAV_CONFIG.map((item, idx) => {
              if (item.section) {
                return (
                  <div key={`section-${idx}`} className={`nav-section-label ${item.sectionClass}`}>
                    {item.section}
                  </div>
                )
              }
              const { to, icon: Icon, labelKey, premium } = item
              return (
                <NavLink
                  key={to}
                  to={to}
                  style={({ isActive }) => ({
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <div style={styles.navActiveBorder} />}
                      <span style={{
                        ...styles.navIconWrap,
                        color: isActive ? '#E1306C' : 'var(--text-muted)',
                      }}>
                        <Icon size={18} />
                      </span>
                      <span style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)', flex: 1 }}>
                        {t(labelKey)}
                      </span>
                      {premium && (
                        <span style={{
                          fontSize: '0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                          padding: '2px 6px', borderRadius: 99, lineHeight: 1,
                          background: 'linear-gradient(135deg, rgba(0,200,255,0.18), rgba(160,110,255,0.18))',
                          border: '1px solid rgba(0,200,255,0.25)',
                          color: '#00C8FF', letterSpacing: '0.05em',
                        }}>✦</span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* User info */}
          <div
            style={{ ...styles.userBlock, cursor: 'pointer' }}
            onClick={() => navigate('/profile')}
            title="View profile"
          >
            <div style={{
              ...styles.avatarCircle,
              boxShadow: location.pathname === '/profile' ? '0 0 16px rgba(0,200,255,0.5)' : '0 0 10px rgba(0,200,255,0.3)',
              border: location.pathname === '/profile' ? '2px solid var(--accent)' : '2px solid transparent',
              overflow: 'hidden', padding: 0,
            }}>
              {user?.avatar
                ? <img src={user.avatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : userInitial}
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userName}>{userName}</div>
              <div style={styles.userPlan}>
                <span style={{ ...styles.planDot, background: planColor, boxShadow: `0 0 6px ${planColor}` }} />
                {user?.plan || 'FREE'} Plan
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>

          {/* Pricing link */}
          {user?.plan === 'FREE' && (
            <button
              onClick={() => navigate('/pricing')}
              style={{
                background: 'linear-gradient(135deg, #00E5FF 0%, #00C8FF 50%, #7B5CF0 100%)',
                border: 'none',
                borderRadius: 10,
                padding: '11px 12px',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                marginBottom: 4,
                transition: 'all 0.18s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 18px rgba(0,200,255,0.35)',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 6px 26px rgba(0,200,255,0.55)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,200,255,0.35)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <span style={{ fontSize: '1rem' }}>✦</span>
              <span>Upgrade to Pro</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.68rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>₹799/mo</span>
            </button>
          )}

          {/* Language + Theme toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <LanguageSelector compact />
            </div>
            <ThemeToggle size="sm" />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-faint)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <IconLogout size={14} />
            {t('sign_out')}
          </button>
        </aside>
      )}

      {/* ── Main content area ───────────────────────────────────── */}
      <main style={styles.main}>

        {/* Mobile top header */}
        {isMobile && (
          <header style={styles.mobileHeader}>
            <div style={styles.mobileLogoRow}>
              <Logo size={32} showWordmark />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LanguageSelector compact />
              <div
                style={{ ...styles.mobileAvatar, overflow: 'hidden', padding: 0 }}
                title={userName}
                onClick={() => navigate('/profile')}
              >
                {user?.avatar
                  ? <img src={user.avatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : userInitial}
              </div>
            </div>
          </header>
        )}

        {/* Page content */}
        <div className="content" style={isMobile ? styles.contentMobile : styles.contentDesktop}>
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ─────────────────────────────── */}
      {isMobile && (
        <>
          {/* More sheet backdrop */}
          {moreOpen && (
            <div
              onClick={() => setMoreOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 99,
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(4px)',
              }}
            />
          )}

          {/* More sheet */}
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: moreOpen ? 64 : '-100%',
            zIndex: 100,
            background: 'var(--surface-nav)',
            borderTop: '1px solid var(--border-nav)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 16px 12px',
            transition: 'bottom 0.3s cubic-bezier(0.32,0.72,0,1)',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 20px' }} />

            {[
              { section: 'Studio', items: [
                { to: '/scripts',     icon: IconScripts,     label: t('nav_scripts')     },
                { to: '/creator-dna', icon: VoiceIcon,       label: t('nav_my_voice')  },
              ]},
              { section: 'Content', items: [
                { to: '/crosspost',   icon: RemixIcon,       label: t('nav_remix')       },
                { to: '/templates',   icon: TemplateIcon,    label: t('nav_templates')   },
              ]},
              { section: 'Insights', items: [
                { to: '/trending',    icon: TrendIcon,       label: t('nav_trending')    },
                { to: '/performance', icon: IconPerformance, label: t('nav_performance') },
                { to: '/calendar',    icon: CalendarIcon,    label: t('nav_calendar')    },
              ]},
            ].map(group => (
              <div key={group.section} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  color: 'var(--text-faint)', marginBottom: 10, paddingLeft: 4,
                }}>
                  {group.section}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {group.items.map(({ to, icon: Icon, label, premium }) => {
                    const isActive = location.pathname === to
                    return (
                      <NavLink
                        key={to} to={to}
                        onClick={() => setMoreOpen(false)}
                        style={{ textDecoration: 'none' }}
                      >
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: 6, padding: '12px 8px', borderRadius: 14,
                          background: isActive ? 'rgba(225,48,108,0.10)' : 'var(--surface2)',
                          border: `1px solid ${isActive ? 'rgba(225,48,108,0.28)' : 'var(--border)'}`,
                        }}>
                          <span style={{ color: isActive ? '#E1306C' : 'var(--text-muted)' }}>
                            <Icon size={22} />
                          </span>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600, textAlign: 'center',
                            color: isActive ? '#E1306C' : 'var(--text-muted)',
                            lineHeight: 1.2,
                          }}>
                            {label}
                            {premium && <span style={{ display: 'block', fontSize: '0.58rem', color: '#00C8FF', marginTop: 2 }}>✦</span>}
                          </span>
                        </div>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom tab bar */}
          <nav className="bottom-nav app-bottom-nav" aria-label="Main navigation">
            {MOBILE_NAV_CONFIG.map(({ to, icon: Icon, labelKey }) => (
              <NavLink
                key={to} to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
                aria-label={t(labelKey)}
              >
                {({ isActive }) => (
                  <>
                    <div className="nav-dot" />
                    <Icon size={22} />
                    <span
                      className="bottom-nav-label"
                      style={isActive ? { background: 'linear-gradient(135deg, #FCAF45, #E1306C 55%, #833AB4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}}
                    >
                      {t(labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}

            {/* More tab */}
            <button
              className={`bottom-nav-item${moreOpen ? ' active' : ''}`}
              onClick={() => setMoreOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div className="nav-dot" />
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              <span
                className="bottom-nav-label"
                style={moreOpen ? { background: 'linear-gradient(135deg, #00C8FF, #7B5CF0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}}
              >
                More
              </span>
            </button>
          </nav>
        </>
      )}

    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg)',
  },

  /* ── Sidebar ── */
  sidebar: {
    width: '240px',
    flexShrink: 0,
    background: 'var(--surface-nav)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRight: '1px solid var(--border-nav)',
    boxShadow: 'inset -1px 0 0 rgba(0,200,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 14px',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    gap: '4px',
  },

  logoWrap: {
    padding: '6px 0 20px',
    borderBottom: '1px solid var(--border-nav)',
    marginBottom: '16px',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },

  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'all 0.18s ease',
    position: 'relative',
    letterSpacing: '-0.01em',
  },
  navItemActive: {
    background: 'linear-gradient(135deg, rgba(252,175,69,0.13) 0%, rgba(225,48,108,0.10) 55%, rgba(131,58,180,0.07) 100%)',
    fontWeight: '600',
    boxShadow: 'inset 0 0 0 1px rgba(225,48,108,0.20)',
  },
  navActiveBorder: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '3px',
    height: '22px',
    borderRadius: '0 4px 4px 0',
    background: 'linear-gradient(180deg, #FCAF45, #E1306C 50%, #833AB4)',
  },
  navIconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    flexShrink: 0,
  },

  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'var(--surface-userblock)',
    borderRadius: '12px',
    marginTop: '8px',
    marginBottom: '4px',
    flexShrink: 0,
    border: '1px solid var(--border-nav)',
    transition: 'all 0.18s ease',
  },
  avatarCircle: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#fff',
    flexShrink: 0,
    boxShadow: '0 0 10px rgba(0,200,255,0.3)',
  },
  userInfo: {
    overflow: 'hidden',
    flex: 1,
  },
  userName: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  userPlan: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.68rem',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginTop: '1px',
  },
  planDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  logoutBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text-faint)',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-body)',
    fontWeight: '500',
    padding: '9px 12px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.18s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
    letterSpacing: '-0.01em',
  },

  /* ── Main ── */
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    minWidth: 0,
    overflow: 'hidden',
  },

  contentDesktop: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '40px 32px',
    width: '100%',
  },
  contentMobile: {
    padding: '20px 16px 100px',
    width: '100%',
  },

  /* ── Mobile header ── */
  mobileHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: 'var(--surface-header)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderBottom: '1px solid var(--border-header)',
    boxShadow: '0 1px 0 rgba(0,200,255,0.05)',
    minHeight: '56px',
  },
  mobileLogoRow: {
    display: 'flex',
    alignItems: 'center',
  },
  mobileAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 0 10px rgba(0,200,255,0.3)',
  },
}
