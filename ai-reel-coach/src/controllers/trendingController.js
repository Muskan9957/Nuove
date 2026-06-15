const prisma    = require('../config/prisma')
const aiService = require('../services/aiService')

// ─── GET /api/trending/greeting?region=India&language=hi ─────────
// Always calls AI fresh — no DB cache — so language changes are instant
const getGreeting = async (req, res, next) => {
  try {
    const region   = (req.query.region   || 'India').trim()
    const userLang = (req.query.language || 'en').trim()

    const data = await aiService.getRegionalGreeting(region, userLang)

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
const refreshInBackground = (niche, language, today, region = 'India') => {
  aiService.getTrendingTopicsLive(niche, language, region)
    .then(topics =>
      prisma.trendingCache.upsert({
        where  : { niche_language_date: { niche, language, date: today } },
        create : { niche, language, topics: JSON.stringify(topics), date: today },
        update : { topics: JSON.stringify(topics) },
      })
    )
    .catch(err => console.error('[trending] background refresh failed:', err.message))
}

// ─── GET /api/trending?niche=fitness&language=en&region=India ─────
const get = async (req, res, next) => {
  try {
    const niche    = (req.query.niche    || 'general').toLowerCase().trim()
    const language = (req.query.language || 'en').toLowerCase().trim()
    const region   = (req.query.region   || 'India').trim()
    const force    = req.query.force === 'true'
    const today    = new Date().toISOString().slice(0, 10)

    // 1. Today's cache — respond instantly (unless forcing refresh)
    if (!force) {
      const todayCache = await prisma.trendingCache.findUnique({
        where: { niche_language_date: { niche, language, date: today } },
      })
      if (todayCache) {
        return res.json({ niche, language, date: today, topics: JSON.parse(todayCache.topics), cached: true })
      }
    }

    // 2. Stale cache (any previous day) — respond instantly, refresh in background
    if (!force) {
      const staleCache = await prisma.trendingCache.findFirst({
        where  : { niche, language },
        orderBy: { date: 'desc' },
      })
      if (staleCache) {
        // Send stale data right away so the user sees content immediately
        res.json({ niche, language, date: staleCache.date, topics: JSON.parse(staleCache.topics), cached: true, stale: true })
        // Quietly generate today's topics in background for the next visit
        refreshInBackground(niche, language, today, region)
        return
      }
    }

    // 3. No cache at all (or forced refresh) — must wait for AI
    const topics = await aiService.getTrendingTopicsLive(niche, language, region)
    await prisma.trendingCache.upsert({
      where : { niche_language_date: { niche, language, date: today } },
      create: { niche, language, topics: JSON.stringify(topics), date: today },
      update: { topics: JSON.stringify(topics) },
    })
    return res.json({ niche, language, date: today, topics, cached: false })

  } catch (err) {
    next(err)
  }
}

module.exports = { get, getGreeting }
