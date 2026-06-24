require('dotenv').config({ override: true });
require('./config/sentry');   // init error monitoring before anything else
const app    = require('./app');
const prisma = require('./config/prisma');
const aiService = require('./services/aiService');
const trendEngineV2 = require('./services/trendsV2/trendEngineV2');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n🚀 AI Reel Coach API running on port ${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Docs        : http://localhost:${PORT}/api/health\n`);

  // ── Warm trending cache in background ──────────────────────────
  // Runs after startup so it never delays boot. Generates today's topics
  // for all popular niches/languages so the first user request is instant.
  warmTrendingCache()
});

// Pre-warm the most-used combos so the first dashboard load is instant.
// IMPORTANT: use the SAME normalized niche/region keys the request path resolves
// to (e.g. 'business & finance', not 'finance') or the cache lookups never hit.
const WARM_NICHES  = ['general', 'fitness', 'business & finance', 'gaming', 'food', 'travel', 'ai & technology'] // home region (India)
const WARM_REGIONS = ['US', 'UK', 'Global', 'Japan', 'Brazil', 'Germany']                                       // 'general' feed each
const WARM_LANG    = 'en'

async function warmOne(niche, region, scope, today) {
  try {
    const where = { niche_language_region_scope_date: { niche, language: WARM_LANG, region, scope, date: today } }
    if (await prisma.trendingCache.findUnique({ where })) return // already warm today

    console.log(`[cache-warm] generating ${niche} · ${region}/${scope}…`)
    let topics = []
    try {
      topics = await trendEngineV2.getTrendsV2(region, niche, scope)
      if (!topics || topics.length === 0) throw new Error('V2 returned empty')
    } catch (err) {
      console.warn(`[cache-warm] V2 failed (${region}/${niche}): ${err.message}`)
      topics = await aiService.getTrendingTopicsLive(niche, WARM_LANG, region)
    }

    await prisma.trendingCache.upsert({
      where,
      create: { niche, language: WARM_LANG, region, scope, topics: JSON.stringify(topics), date: today },
      update: { topics: JSON.stringify(topics) },
    })
    console.log(`[cache-warm] ✓ ${niche} · ${region}/${scope}`)
    await new Promise(r => setTimeout(r, 800)) // small gap to avoid provider rate limits
  } catch (err) {
    console.error(`[cache-warm] failed ${niche}/${region}:`, err.message)
  }
}

async function warmTrendingCache() {
  const today = new Date().toISOString().slice(0, 10)
  // 1. Home region (India) — warm all popular niches.
  for (const niche of WARM_NICHES) await warmOne(niche, 'India', 'local', today)
  // 2. Other popular regions — warm the default feed (Global included).
  for (const region of WARM_REGIONS) await warmOne('general', region, region === 'Global' ? 'global' : 'local', today)
  console.log('[cache-warm] done')
}
