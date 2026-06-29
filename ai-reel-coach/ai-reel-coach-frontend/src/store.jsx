import { createContext, useContext, useState, useEffect } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)

// Per-user data cached in localStorage. Cleared on every login / signup / logout
// so a fresh session — or a different person on the same browser — never sees the
// previous user's script generator, dashboard, or prefs.
const STALE_USER_KEYS = [
  'arc_gen_form', 'arc_gen_result', 'arc_gen_versions', 'arc_gen_activeVer', 'arc_gen_rerolls', 'arc_prefill_topic',
  'dash_scripts', 'dash_logs', 'dash_badges', 'dash_profile', 'vs_prefs',
]
export const clearStaleUserData = () => {
  STALE_USER_KEYS.forEach(k => { try { localStorage.removeItem(k) } catch {} })
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle OAuth redirect — token comes back in URL query params
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('token')
    const oauthError = params.get('error')

    if (oauthError === 'instagram_coming_soon') {
      window.history.replaceState({}, '', window.location.pathname)
      setLoading(false)
      return
    }

    if (oauthToken) {
      localStorage.setItem('arc_token', oauthToken)
      try {
        sessionStorage.clear()
      } catch {}
      // Clean the token from URL immediately
      window.history.replaceState({}, '', window.location.pathname)
    }

    const token = localStorage.getItem('arc_token')
    if (!token) { setLoading(false); return }
    api.getMe()
      .then(d => {
        if (d.user.onboarded) localStorage.setItem('vs_onboarded', '1')
        setUser(d.user)
      })
      .catch(() => {
        localStorage.removeItem('arc_token')
        try { sessionStorage.clear() } catch {}
      })
      .finally(() => setLoading(false))

    // Global listener to refresh user stats (streak, usage, badges) when events fire
    const handleRefresh = () => refreshUser()
    window.addEventListener('streak-updated', handleRefresh)
    window.addEventListener('usage-updated', handleRefresh)
    window.addEventListener('badge-earned', handleRefresh)
    return () => {
      window.removeEventListener('streak-updated', handleRefresh)
      window.removeEventListener('usage-updated', handleRefresh)
      window.removeEventListener('badge-earned', handleRefresh)
    }
  }, [])

  const login = async (email, password) => {
    const data = await api.login({ email, password })
    localStorage.setItem('arc_token', data.token)
    
    const lastUser = localStorage.getItem('arc_last_user')
    if (lastUser !== data.user.email) {
      clearStaleUserData() // fresh start only for different user
    }
    localStorage.setItem('arc_last_user', data.user.email)

    setUser(data.user)
    return data
  }

  const register = async (email, password, name) => {
    const data = await api.register({ email, password, name })
    // If email verification is needed, don't set user session yet
    if (data.needsVerification) return data
    localStorage.setItem('arc_token', data.token)
    localStorage.removeItem('vs_onboarded')
    
    const lastUser = localStorage.getItem('arc_last_user')
    if (lastUser !== data.user.email) {
      clearStaleUserData()
    }
    localStorage.setItem('arc_last_user', data.user.email)

    setUser(data.user)
    return data
  }

  const refreshUser = async () => {
    try {
      const d = await api.getMe()
      setUser(d.user)
      return d.user
    } catch {
      return null
    }
  }

  const logout = () => {
    localStorage.removeItem('arc_token')
    localStorage.removeItem('vs_onboarded')
    // We intentionally do NOT clear STALE_USER_KEYS here, so the workspace is preserved
    // if the same user logs back in. It will be cleared in login() if a different user logs in.
    try {
      // Don't clear sessionStorage entirely to preserve arc_return_url
      sessionStorage.removeItem('arc_return_url') 
    } catch {}
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
