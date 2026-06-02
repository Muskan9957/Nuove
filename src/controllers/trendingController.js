const prisma      = require('../config/prisma')
const aiService   = require('../services/aiService')
const trendsService = require('../services/trendsService')

// ─── Cache TTL: 3 hours ────────────────────────────────────────────────────
const CACHE_TTL_MS = 3 * 60 * 60 * 1000   // 3 hours

// ─── In-memory greeting cache ─────────────────────────────────────────────
const greetingMem = new Map()

// ─── Helper: 3-hour slot key (e.g. "2025-06-02-14" = 2pm slot) ───────────
function hourSlot() {
  const d = new Date()
  return `${d.toISOString().slice(0, 10)}-${Math.floor(d.getUTCHours() / 3) * 3}`
}

// ─── GET /api/trending/greeting?region=India&language=hi ─────────────────
const getGreeting = async (req, res, next) => {
  const region   = (req.query.region   || 'India').trim()
  const userLang = (req.query.language || 'en').trim()
  const today    = new Date().toISOString().slice(0, 10)
  const memKey   = `${region}:${userLang}:${today}`
  const dbNiche  = `_greeting_${region}`

  // 1. Memory hit — instant
  if (greetingMem.has(memKey)) {
    return res.json(greetingMem.get(memKey))
  }

  // 2. DB cache hit — fast (survives server restarts)
  try {
    const dbRow = await prisma.trendingCache.findUnique({
      where: { niche_language_date: { niche: dbNiche, language: userLang, date: today } },
    })
    if (dbRow) {
      const cached = JSON.parse(dbRow.topics)
      greetingMem.set(memKey, cached)
      return res.json(cached)
    }

    // 3. Stale DB — return immediately, refresh silently
    const stale = await prisma.trendingCache.findFirst({
      where: { niche: dbNiche, language: userLang },
      orderBy: { date: 'desc' },
    })
    if (stale) {
      const staleData = JSON.parse(stale.topics)
      greetingMem.set(memKey, staleData)
      res.json(staleData)
      aiService.getRegionalGreeting(region, userLang)
        .then(fresh => {
          const { _isFallback, ...d } = fresh
          greetingMem.set(memKey, d)
          prisma.trendingCache.upsert({
            where:  { niche_language_date: { niche: dbNiche, language: userLang, date: today } },
            create: { niche: dbNiche, language: userLang, date: today, topics: JSON.stringify(d) },
            update: { topics: JSON.stringify(d) },
          }).catch(() => {})
        }).catch(() => {})
      return
    }
  } catch {}

  // 4. No cache — call AI
  try {
    const data = await aiService.getRegionalGreeting(region, userLang)
    const { _isFallback, ...responseData } = data
    greetingMem.set(memKey, responseData)
    prisma.trendingCache.upsert({
      where:  { niche_language_date: { niche: dbNiche, language: userLang, date: today } },
      create: { niche: dbNiche, language: userLang, date: today, topics: JSON.stringify(responseData) },
      update: { topics: JSON.stringify(responseData) },
    }).catch(() => {})
    return res.json(responseData)
  } catch (err) {
    next(err)
  }
}

// ─── Background refresh for trending topics ───────────────────────────────
const refreshInBackground = (niche, language, region, slot) => {
  aiService.getTrendingTopicsLive(niche, language, region)
    .then(topics => {
      const payload = JSON.stringify({ topics, fetchedAt: Date.now(), region, slot })
      return prisma.trendingCache.upsert({
        where  : { niche_language_date: { niche, language, date: slot } },
        create : { niche, language, topics: payload, date: slot },
        update : { topics: payload },
      })
    })
    .catch(err => console.error('[trending] background refresh failed:', err.message))
}

// ─── GET /api/trending?niche=fitness&language=en&region=India&force=true ──
const get = async (req, res, next) => {
  try {
    const niche    = (req.query.niche    || 'general').toLowerCase().trim()
    const language = (req.query.language || 'en').toLowerCase().trim()
    const region   = (req.query.region   || 'India').trim()
    const force    = req.query.force === 'true'
    const slot     = hourSlot()   // changes every 3 hours

    // ── Skip cache when force=true (Refresh button) ──────────────────────
    if (!force) {
      const cached = await prisma.trendingCache.findUnique({
        where: { niche_language_date: { niche, language, date: slot } },
      })

      if (cached) {
        try {
          const parsed = JSON.parse(cached.topics)
          // Support both old format (plain array) and new format ({ topics, fetchedAt })
          const topics    = Array.isArray(parsed) ? parsed : parsed.topics
          const fetchedAt = Array.isArray(parsed) ? null   : parsed.fetchedAt

          // If cache is older than TTL, refresh in background but still serve it
          if (fetchedAt && Date.now() - fetchedAt > CACHE_TTL_MS) {
            res.json({ niche, language, region, topics, fetchedAt, cached: true, stale: true })
            refreshInBackground(niche, language, region, slot)
            return
          }

          return res.json({ niche, language, region, topics, fetchedAt, cached: true })
        } catch { /* fall through to fresh fetch */ }
      }
    }

    // ── Fresh fetch from live sources ─────────────────────────────────────
    const topics    = await aiService.getTrendingTopicsLive(niche, language, region)
    const fetchedAt = Date.now()
    const payload   = JSON.stringify({ topics, fetchedAt, region, slot })

    prisma.trendingCache.upsert({
      where  : { niche_language_date: { niche, language, date: slot } },
      create : { niche, language, topics: payload, date: slot },
      update : { topics: payload },
    }).catch(() => {})

    return res.json({ niche, language, region, topics, fetchedAt, cached: false })

  } catch (err) {
    next(err)
  }
}

// ─── GET /api/trending/audio?region=India ─────────────────────────────────
// Returns Spotify Viral 50 tracks for the user's region
const getAudio = async (req, res, next) => {
  try {
    const region = (req.query.region || 'India').trim()
    const tracks = await trendsService.fetchSpotifyTrendingAudio(region)

    // Always return something — fallback message if Spotify not configured
    if (!tracks.length) {
      return res.json({
        region,
        tracks: [],
        message: 'Spotify credentials not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env',
      })
    }

    return res.json({ region, tracks, fetchedAt: Date.now() })
  } catch (err) {
    next(err)
  }
}

module.exports = { get, getGreeting, getAudio }
