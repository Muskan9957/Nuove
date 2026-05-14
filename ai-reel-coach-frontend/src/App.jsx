import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store'
import { ToastProvider } from './components/Toast'
import { LangProvider } from './i18n.jsx'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Logo from './components/Logo'
import Auth from './pages/Auth'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Generate from './pages/Generate'
import Score from './pages/Score'
import Performance from './pages/Performance'
import Calendar from './pages/Calendar'
import Trending from './pages/Trending'
import Templates from './pages/Templates'
import Captions from './pages/Captions'
import Crosspost from './pages/Crosspost'
import Coach from './pages/Coach'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Pricing from './pages/Pricing'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Demo from './pages/Demo'
import Scripts from './pages/Scripts'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import ReelReady from './pages/ReelReady'
import Record from './pages/Record'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div>
          <Logo size={52} showWordmark />
        </div>
        <p style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.12em' }}>
          LOADING
        </p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/" replace />

  // Redirect to onboarding if not yet completed (skip if already going there)
  const onboarded = localStorage.getItem('vs_onboarded')
  const isOnboardingRoute = window.location.pathname === '/onboarding'
  if (!onboarded && !isOnboardingRoute) return <Navigate to="/onboarding" replace />

  return <Layout>{children}</Layout>
}

// Onboarding route — protected but renders without Layout
function OnboardingRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  if (localStorage.getItem('vs_onboarded')) return <Navigate to="/dashboard" replace />
  return <Onboarding />
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LangProvider>
            <ToastProvider>
              <Routes>
                <Route path="/"             element={<LandingRoute />} />
                <Route path="/auth"         element={<AuthRoute />} />
                <Route path="/pricing"          element={<Pricing />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password"  element={<ResetPassword />} />
                <Route path="/demo"            element={<Demo />} />
                <Route path="/privacy"         element={<PrivacyPolicy />} />
                <Route path="/terms"           element={<Terms />} />
                <Route path="/onboarding"      element={<OnboardingRoute />} />
                <Route path="/dashboard"    element={<Protected><Dashboard /></Protected>} />
                <Route path="/generate"     element={<Protected><Generate /></Protected>} />
                <Route path="/scripts"      element={<Protected><Scripts /></Protected>} />
                <Route path="/score"        element={<Protected><Score /></Protected>} />
                <Route path="/performance"  element={<Protected><Performance /></Protected>} />
                <Route path="/calendar"     element={<Protected><Calendar /></Protected>} />
                <Route path="/trending"     element={<Protected><Trending /></Protected>} />
                <Route path="/templates"    element={<Protected><Templates /></Protected>} />
                <Route path="/captions"     element={<Protected><Captions /></Protected>} />
                <Route path="/crosspost"    element={<Protected><Crosspost /></Protected>} />
                <Route path="/multiply"     element={<Navigate to="/crosspost" replace />} />
                <Route path="/remix"        element={<Navigate to="/crosspost" replace />} />
                <Route path="/coach"        element={<Protected><Coach /></Protected>} />
                <Route path="/profile"      element={<Protected><Profile /></Protected>} />
                <Route path="/reel-ready"   element={<Protected><ReelReady /></Protected>} />
                <Route path="/record"       element={<Protected><Record /></Protected>} />
                <Route path="/creator-dna"  element={<Navigate to="/reel-ready" replace />} />
                <Route path="/my-voice"     element={<Navigate to="/reel-ready" replace />} />
                <Route path="*"             element={<Navigate to="/" replace />} />
              </Routes>
            </ToastProvider>
          </LangProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

function LandingRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Landing />
}

function AuthRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Auth />
}
