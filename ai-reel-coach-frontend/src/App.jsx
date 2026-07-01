import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store'
import { ToastProvider } from './components/Toast'
import { LangProvider } from './i18n.jsx'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Logo from './components/Logo'
import Auth from './pages/Auth'
import Landing from './pages/Landing'
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Generate = React.lazy(() => import('./pages/Generate'));
const Score = React.lazy(() => import('./pages/Score'));
const Performance = React.lazy(() => import('./pages/Performance'));
const Calendar = React.lazy(() => import('./pages/Calendar'));
const Trending = React.lazy(() => import('./pages/Trending'));
const Templates = React.lazy(() => import('./pages/Templates'));
const Captions = React.lazy(() => import('./pages/Captions'));
const Crosspost = React.lazy(() => import('./pages/Crosspost'));
const Coach = React.lazy(() => import('./pages/Coach'));
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Demo = React.lazy(() => import('./pages/Demo'));
const Scripts = React.lazy(() => import('./pages/Scripts'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const Record = React.lazy(() => import('./pages/Record'));
const Support = React.lazy(() => import('./pages/Support'));
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'));


const PageLoader = () => (
  <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div className="page-spinner" style={{ width: 40, height: 40, border: '3px solid var(--surface3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  </div>
);

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
  if (!user) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/auth') {
      sessionStorage.setItem('arc_return_url', window.location.pathname + window.location.search)
    }
    return <Navigate to="/" replace />
  }

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
  if (!user) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/auth') {
      sessionStorage.setItem('arc_return_url', window.location.pathname + window.location.search)
    }
    return <Navigate to="/" replace />
  }
  if (localStorage.getItem('vs_onboarded')) return <Navigate to="/dashboard" replace />
  return <Onboarding />
}


function prefetchRoutes() {
  const routesToPrefetch = [
    () => import('./pages/Dashboard'),
    () => import('./pages/Generate'),
    () => import('./pages/Trending'),
    () => import('./pages/Profile')
  ];
  routesToPrefetch.forEach(importFn => {
    importFn().catch(() => {});
  });
}

export default function App() {
  useEffect(() => {
    // Prefetch critical routes after initial load
    setTimeout(prefetchRoutes, 2000);
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LangProvider>
            <ToastProvider>
              <Suspense fallback={<PageLoader />}><Routes>
                <Route path="/"             element={<LandingRoute />} />
                <Route path="/auth"         element={<AuthRoute />} />
                <Route path="/pricing"          element={<Pricing />} />
                <Route path="/verify-email"     element={<VerifyEmail />} />
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
                <Route path="/record"       element={<Protected><Record /></Protected>} />
                <Route path="/support"      element={<Protected><Support /></Protected>} />
                <Route path="/reel-ready"   element={<Navigate to="/dashboard" replace />} />
                <Route path="/creator-dna"  element={<Navigate to="/dashboard" replace />} />
                <Route path="/my-voice"     element={<Navigate to="/dashboard" replace />} />
                <Route path="*"             element={<Navigate to="/" replace />} />
              </Routes></Suspense>
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
  if (user) {
    const returnUrl = sessionStorage.getItem('arc_return_url')
    return <Navigate to={returnUrl || "/dashboard"} replace />
  }
  return <Landing />
}

function AuthRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) {
    const returnUrl = sessionStorage.getItem('arc_return_url')
    return <Navigate to={returnUrl || "/dashboard"} replace />
  }
  return <Auth />
}
