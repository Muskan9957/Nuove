require('dotenv').config({ override: true });
require('./config/sentry');   // init error monitoring before anything else
const app    = require('./app');
const prisma = require('./config/prisma');
const aiService = require('./services/aiService');
const trendEngineV2 = require('./services/trendsV2/trendEngineV2');
const { backfillConversations } = require('./services/backfillConversations');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n🚀 AI Reel Coach API running on port ${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Docs        : http://localhost:${PORT}/api/health\n`);

  // ── One-time: group legacy coach messages into conversations ───
  // Idempotent — only touches ChatMessage rows with conversationId = null.
  backfillConversations()

  // ── Warm trending cache in background ──────────────────────────
  // Runs after startup so it never delays boot. Generates today's topics
  // for all popular niches/languages so the first user request is instant.
  warmTrendingCache()
});

// Trimmed to stay well within the Gemini free tier — only the few most-used
// niches are pre-warmed (3 calls per boot vs 16). Everything else generates
// on first request and is then cached, so users still get instant results.
const WARM_NICHES    = ['general', 'fitness', 'finance']
const WARM_LANGUAGES = ['en']

async function warmTrendingCache() {
  const today = new Date().toISOString().slice(0, 10)

  for (const niche of WARM_NICHES) {
    for (const language of WARM_LANGUAGES) {
      try {
        // Skip if today's cache already exists
        const exists = await prisma.trendingCache.findUnique({
          where: { niche_language_region_scope_date: { niche, language, region: 'India', scope: 'local', date: today } },
        })
        if (exists) continue

        console.log(`[cache-warm] generating ${niche}/${language}…`)
        let topics = []
        try {
          topics = await trendEngineV2.getTrendsV2('India', niche, 'local')
          if (!topics || topics.length === 0) throw new Error('V2 returned empty')
        } catch (err) {
          console.warn(`[cache-warm] V2 failed, falling back to V1: ${err.message}`)
          topics = await aiService.getTrendingTopicsLive(niche, language, 'India')
        }

        await prisma.trendingCache.upsert({
          where  : { niche_language_region_scope_date: { niche, language, region: 'India', scope: 'local', date: today } },
          create : { niche, language, region: 'India', scope: 'local', topics: JSON.stringify(topics), date: today },
          update : { topics: JSON.stringify(topics) },
        })
        console.log(`[cache-warm] ✓ ${niche}/${language}`)

        // Small gap between calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 800))
      } catch (err) {
        console.error(`[cache-warm] failed ${niche}/${language}:`, err.message)
      }
    }
  }
  console.log('[cache-warm] done')
}
