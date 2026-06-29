/**
 * usePrefs — reads onboarding preferences from localStorage
 * and exposes them in a clean, ready-to-use shape.
 */
export function usePrefs() {
  let raw = {}
  try { raw = JSON.parse(localStorage.getItem('vs_prefs') || '{}') } catch {}

  const goals         = Array.isArray(raw.goals)   ? raw.goals   : []
  const platform      = raw.platform || null
  const targetAudience = raw.targetAudience || localStorage.getItem('arc_audience') || 'India'

  // Human-readable summary for the AI system prompt
  const goalContext = goals.length
    ? `Creator goals: ${goals.join(', ')}.`
    : ''
  const platformContext = platform
    ? `Primary platform: ${platform}.`
    : ''

  const aiContext = [goalContext, platformContext].filter(Boolean).join(' ')

  return { goals, platform, aiContext, targetAudience }
}
