// Native-app (Capacitor) integration. Everything here no-ops on the website —
// the plugins are dynamically imported only when running inside the app shell.
import { Capacitor } from '@capacitor/core'

export const isNativeApp = Capacitor.isNativePlatform()

export async function initNative() {
  if (!isNativeApp) return

  const { App } = await import('@capacitor/app')

  // ── Status bar: match the app theme ─────────────────────────────
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })          // light icons
    await StatusBar.setBackgroundColor({ color: '#080507' }) // = --bg (dark)
  } catch { /* plugin unavailable (e.g. web) — ignore */ }

  // ── Android hardware back button ────────────────────────────────
  // Navigate back through the SPA; from the root screens, minimize the app
  // instead of killing it (the Android-native expectation).
  App.addListener('backButton', ({ canGoBack }) => {
    const root = ['/', '/dashboard', '/login']
    if (!root.includes(window.location.pathname) && canGoBack) {
      window.history.back()
    } else {
      App.minimizeApp()
    }
  })

  // ── OAuth deep-link return (in.nuove.app://auth/?token=...) ─────
  // Google login opens in the system browser (Google blocks OAuth inside
  // webviews); the backend redirects back to this custom scheme with the JWT.
  App.addListener('appUrlOpen', async ({ url }) => {
    try {
      const u = new URL(url)
      const token = u.searchParams.get('token')
      if (token) {
        localStorage.setItem('arc_token', token)
        try {
          const { Browser } = await import('@capacitor/browser')
          await Browser.close() // dismiss the custom tab if still open
        } catch { }
        window.location.href = '/dashboard'
      }
    } catch { /* not a URL we understand — ignore */ }
  })
}

// Open an OAuth flow correctly per platform: system browser (custom tab) in the
// app, plain navigation on the web.
export async function openOAuth(url) {
  if (!isNativeApp) {
    window.location.href = url
    return
  }
  const { Browser } = await import('@capacitor/browser')
  const sep = url.includes('?') ? '&' : '?'
  await Browser.open({ url: `${url}${sep}platform=${Capacitor.getPlatform()}` })
}
