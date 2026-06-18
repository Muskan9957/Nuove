require('dotenv').config({ override: true });
require('./config/sentry');   // init error monitoring before anything else
const app    = require('./app');
const prisma = require('./config/prisma');
const aiService = require('./services/aiService');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n🚀 AI Reel Coach API running on port ${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Docs        : http://localhost:${PORT}/api/health`);
  console.log(`   TTS route   : /api/tts (ElevenLabs)\n`);

  // ── Warm trending cache in background ──────────────────────────
  // Runs after startup so it never delays boot. Generates today's topics
  // for all popular niches/languages so the first user request is instant.
  warmTrendingCache()
});

const WARM_NICHES    = ['general','fitness','finance','food','tech','lifestyle','fashion','travel']
const WARM_LANGUAGES = ['en', 'hi']

async function warmTrendingCache() {
  const today = new Date().toISOString().slice(0, 10)

  for (const niche of WARM_NICHES) {
    for (const language of WARM_LANGUAGES) {
      try {
        // Skip if today's cache already exists
        const exists = await prisma.trendingCache.findUnique({
          where: { niche_language_date: { niche, language, date: today } },
        })
        if (exists) continue

        console.log(`[cache-warm] generating ${niche}/${language}…`)
        const topics = await aiService.getTrendingTopics(niche, language)
        await prisma.trendingCache.upsert({
          where  : { niche_language_date: { niche, language, date: today } },
          create : { niche, language, topics: JSON.stringify(topics), date: today },
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
