// In production (Vercel), VITE_API_URL points to the Railway backend.
// In dev, Vite's proxy handles /api → localhost:6003.
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

import fpPromise from '@fingerprintjs/fingerprintjs'
let fpCache = null
const getFingerprint = async () => {
  if (fpCache) return fpCache
  try {
    const fp = await fpPromise.load()
    const result = await fp.get()
    fpCache = result.visitorId
    return fpCache
  } catch (err) { return null }
}

const getToken = () => localStorage.getItem('arc_token')

const req = async (method, path, body) => {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  const deviceFp = await getFingerprint()
  
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (deviceFp) headers['X-Device-Fingerprint'] = deviceFp

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || data.errors?.[0]?.msg || 'Something went wrong')
    err.data = data
    throw err
  }
  
  // Intercept streak updates globally
  if (data.newStreak !== undefined) {
    window.dispatchEvent(new CustomEvent('streak-updated', { detail: data.newStreak }))
  }

  // Intercept badge awards globally
  if (data.newBadges !== undefined && Array.isArray(data.newBadges)) {
    data.newBadges.forEach(badgeType => {
      window.dispatchEvent(new CustomEvent('badge-earned', { detail: badgeType }))
    })
  }
  
  return data
}

export const api = {
  // Auth
  register:      (body)          => req('POST', '/auth/register', body),
  verifyEmail:   (token)         => req('GET', `/auth/verify-email?token=${token}`),
  checkVerification: (email)     => req('GET', `/auth/verification-status?email=${encodeURIComponent(email)}`),
  verifyCode:    (email, code)   => req('POST', '/auth/verify-code', { email, code }),
  login:         (body)          => req('POST', '/auth/login', body),
  getMe:         ()              => req('GET',  '/auth/me'),
  forgotPassword:(email)         => req('POST', '/auth/forgot-password', { email }),
  resetPassword: (body)          => req('POST', '/auth/reset-password', body),

  // Payments (Razorpay)
  createCheckout:      (plan, billing = 'monthly') => req('POST', '/payments/checkout', { plan, billing }),
  verifyPayment:       (body)                      => req('POST', '/payments/verify', body),
  getSubscription:     ()                          => req('GET',  '/payments/subscription'),
  cancelSubscription:  ()                          => req('POST', '/payments/cancel'),
  openPortal:          ()                          => req('POST', '/payments/portal'),

  // Scripts
  // Calls the Vercel Edge Function — true streaming, no Railway buffering
  generateStream: async (body) => {
    const token = getToken()
    const deviceFp = await getFingerprint()
    return fetch(`/api/generate-stream`, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(deviceFp ? { 'X-Device-Fingerprint': deviceFp } : {}),
      },
      body: JSON.stringify(body),
    })
  },
  generate:      (body) => req('POST', '/scripts/generate', body),
  retakeScript:  (body) => req('POST', '/scripts/retake', body),
  refineScript:  (body) => req('POST', '/scripts/refine', body),
  getScripts:    ()     => req('GET',  '/scripts'),
  getScript:     (id)   => req('GET',  `/scripts/${id}`),
  recommendSongs:    (body) => req('POST', '/scripts/songs', body),
  reelReady:         (body) => req('POST', '/reel-ready/analyze', body),
  reelMoreCaptions:  (body) => req('POST', '/reel-ready/more-captions', body),

  // Hooks
  scoreHook:    (body) => req('POST', '/hooks/score', body),
  rewriteHook:  (body) => req('POST', '/hooks/rewrite', body),
  acceptRewrite:(body) => req('POST', '/hooks/rewrite/accept', body),
  hookHistory:  ()     => req('GET',  '/hooks/history'),

  // Performance
  analyze:     (body) => req('POST', '/performance/analyze', body),
  perfHistory: ()     => req('GET',  '/performance/history'),

  // Calendar
  getCalendar:         (month)     => req('GET',    `/calendar?month=${month}`),
  createCalendarEntry: (data)      => req('POST',   '/calendar', data),
  updateCalendarEntry: (id, data)  => req('PATCH',  `/calendar/${id}`, data),
  deleteCalendarEntry: (id)        => req('DELETE', `/calendar/${id}`),

  // Trending — region-aware, force=true bypasses cache for refresh button
  // scope/niche/region create separate backend cache keys.
  getTrending:  (language, region = 'India', force = false, niche, scope = 'local') => {
    const params = new URLSearchParams({ language, region, scope })
    if (force) params.set('force', 'true')
    if (niche) params.set('niche', niche)
    return req('GET', `/trending?${params}`)
  },
  getTrendingAudio: (region = 'India') => req('GET', `/trending/audio?region=${encodeURIComponent(region)}`),
  getGreeting:  (region, language, bust = '', niche, scope = 'local') => {
    return req('GET', `/trending/greeting?region=${encodeURIComponent(region)}&language=${language || 'en'}&niche=${encodeURIComponent(niche || 'general')}&scope=${encodeURIComponent(scope)}${bust}`)
  },

  // Templates
  getTemplates:   (type) => req('GET',    `/templates${type ? `?type=${type}` : ''}`),
  createTemplate: (data) => req('POST',   '/templates', data),
  deleteTemplate: (id)   => req('DELETE', `/templates/${id}`),

  // Reports
  getWeeklyReport: () => req('GET', '/reports/weekly'),

  // Captions
  generateCaptions: (body) => req('POST', '/captions/generate', body),

  // Remix
  remixContent: (body) => req('POST', '/remix/generate', body),

  // Creator Score
  getCreatorScore: () => req('GET', '/score/creator'),

  // AI Coach
  coachChat: (body) => req('POST', '/coach/chat', body),
  listConversations:  ()   => req('GET',    '/coach/conversations'),
  getConversation:    (id) => req('GET',    `/coach/conversations/${id}`),
  deleteConversation: (id) => req('DELETE', `/coach/conversations/${id}`),

  hookAlternatives: (body) => req('POST', '/hooks/alternatives', body),

  // Hook Library
  getHookLibrary: (params) => req('GET', `/hooks/library?category=${params.category || 'all'}&type=${params.type || 'all'}&search=${encodeURIComponent(params.search || '')}`),

  // User
  getUserProfile:  ()         => req('GET',   '/user/profile'),
  updateLanguage:  (language) => req('PATCH', '/user/language', { language }),
  getBadges:       ()         => req('GET',   '/user/badges'),
  markOnboarded:   ()         => req('PATCH', '/user/onboarded'),
  savePrefs:       (body)     => req('PATCH', '/user/prefs', body),
  generateAvatar:  (style)    => req('POST',  '/user/generate-avatar', { style }),
  saveAvatar:      (url)      => req('PATCH', '/user/avatar', { url }),
  pingStreak:      ()         => req('POST',  '/user/streak/ping'),
  deleteAccount:   ()         => req('DELETE', '/user/account'),
  submitSupport:   (message)  => req('POST',  '/user/support', { message }),
  exportMyData:    async () => {
    const res = await fetch(`${BASE}/user/export`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    })
    if (!res.ok) throw new Error('Could not export data')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'nuove-my-data.json'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  },

  // Creator Voice (premium personalisation)
  getVoiceProfile:    ()          => req('GET',    '/user/voice'),
  analyzeVoice:       (samples)   => req('POST',   '/user/voice', { samples }),
  deleteVoiceProfile: ()          => req('DELETE',  '/user/voice'),

  // TTS — returns audio/mpeg blob (Google Neural2 Indian voice)
  tts: (text, lang) => {
    const token = getToken()
    return fetch(`${BASE}/tts`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, lang }),
    })
  },
}
