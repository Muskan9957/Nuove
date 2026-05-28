import { createContext, useContext, useState, useEffect } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)

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
      .catch(() => localStorage.removeItem('arc_token'))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const data = await api.login({ email, password })
    localStorage.setItem('arc_token', data.token)
    setUser(data.user)
    return data
  }

  const register = async (email, password, name) => {
    const data = await api.register({ email, password, name })
    localStorage.setItem('arc_token', data.token)
    // Always clear onboarding state for fresh accounts
    localStorage.removeItem('vs_onboarded')
    localStorage.removeItem('vs_prefs')
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
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
