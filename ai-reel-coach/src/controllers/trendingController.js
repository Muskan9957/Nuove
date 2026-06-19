const prisma    = require('../config/prisma')
const aiService = require('../services/aiService')
const trendEngineV2 = require('../services/trendsV2/trendEngineV2')
const staticFallbackProvider = require('../services/trendsV2/providers/staticFallbackProvider')
const { cacheKeyParts } = require('../services/trendsV2/trendTaxonomy')
const trendsService = require('../services/trendsService')

// ─── GET /api/trending/greeting?region=India&language=hi ─────────
// Always calls AI fresh — no DB cache — so language changes are instant
const getGreeting = async (req, res, next) => {
  try {
    const key = cacheKeyParts({
      niche: req.query.niche || 'general',
      language: req.query.language || 'en',
      region: req.query.region || 'India',
      scope: req.query.scope,
    })
    const region   = key.region
    const userLang = key.language
    const niche    = key.niche
    const scope    = key.scope

    const data = await aiService.getRegionalGreeting(region, userLang, niche)

    // Override the greeting trends with REAL niche trends from V2
    try {
      const realTrends = await trendEngineV2.getTrendsV2(region, niche, scope)
      if (realTrends && realTrends.length >= 3) {
        data.trends = realTrends.slice(0, 3).map(t => ({
          title: t.title,
          description: t.description || 'Trending now',
          category: t.category || niche
        }))
      }
    } catch (err) {
      console.warn('[trending] V2 greeting enrichment failed:', err.message)
    }

    // Strip internal flag before sending to client
    const { _isFallback, ...responseData } = data
    return res.json(responseData)
  } catch (err) {
    next(err)
  }
}

// ─── Background refresh helper ────────────────────────────────────
// Generates fresh topics for today and upserts into cache.
// Never throws — errors are swallowed so they don't affect the response.
const refreshInBackground = (niche, language, today, region = 'India', scope = 'local') => {
  trendEngineV2.getTrendsV2(region, niche, scope)
    .then(topics => {
      if (!topics || topics.length === 0) throw new Error('V2 returned empty')
      return topics
    })
    .catch((err) => {
      console.warn('[trending] V2 background refresh failed, using niche fallback:', err.message)
      return staticFallbackProvider.getStaticFallback(niche, region, scope)
    })
    .then(topics =>
      prisma.trendingCache.upsert({
        where  : { niche_language_region_scope_date: { niche, language, region, scope, date: today } },
        create : { niche, language, region, scope, topics: JSON.stringify(topics), date: today },
        update : { topics: JSON.stringify(topics) },
      })
    )
    .catch(err => console.error('[trending] background refresh failed:', err.message))
}

// ─── GET /api/trending?niche=fitness&language=en&region=India ─────
const get = async (req, res, next) => {
  try {
    const key = cacheKeyParts({
      niche: req.query.niche || 'general',
      language: req.query.language || 'en',
      region: req.query.region || 'India',
      scope: req.query.scope,
      date: new Date().toISOString().slice(0, 10),
    })
    const niche    = key.niche
    const language = key.language
    const region   = key.region
    const scope    = key.scope
    const force    = req.query.force === 'true'
    const today    = key.date

    // 1. Today's cache — respond instantly (unless forcing refresh)
    if (!force) {
      const todayCache = await prisma.trendingCache.findUnique({
        where: {
          niche_language_region_scope_date: { niche, language, region, scope, date: today }
        }
      })
      if (todayCache) {
        return res.json({ niche, language, region, scope, date: today, topics: JSON.parse(todayCache.topics), cached: true })
      }
    }

    // 2. Stale cache (any previous day) — respond instantly, refresh in background
    if (!force) {
      const staleCache = await prisma.trendingCache.findFirst({
        where  : { niche, language, region, scope },
        orderBy: { date: 'desc' },
      })
      if (staleCache) {
        // Send stale data right away so the user sees content immediately
        res.json({ niche, language, region, scope, date: staleCache.date, topics: JSON.parse(staleCache.topics), cached: true, stale: true })
        // Quietly generate today's topics in background for the next visit
        refreshInBackground(niche, language, today, region, scope)
        return
      }
    }

    // 3. No cache at all (or forced refresh) — must wait for AI
    let topics = []
    try {
      topics = await trendEngineV2.getTrendsV2(region, niche, scope)
      if (!topics || topics.length === 0) throw new Error('V2 returned empty topics')
    } catch (err) {
      console.warn('[trending] V2 failed, using niche fallback:', err.stack || err.message)
      topics = staticFallbackProvider.getStaticFallback(niche, region, scope)
    }



    await prisma.trendingCache.upsert({
      where : { niche_language_region_scope_date: { niche, language, region, scope, date: today } },
      create: { niche, language, region, scope, topics: JSON.stringify(topics), date: today },
      update: { topics: JSON.stringify(topics) },
    })
    return res.json({ niche, language, region, scope, date: today, topics, cached: false })

  } catch (err) {
    next(err)
  }
}

const getAudio = async (req, res, next) => {
  try {
    const region = (req.query.region || 'India').trim()
    const tracks = await trendsService.fetchSpotifyTrendingAudio(region)

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
