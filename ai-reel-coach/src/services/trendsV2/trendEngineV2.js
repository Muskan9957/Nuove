const crypto = require('crypto');
const llm = require('../llm');   // provider-agnostic LLM (Gemini/Claude)

const googleTrendProvider = require('./providers/googleTrendProvider');
const youtubeTrendProvider = require('./providers/youtubeTrendProvider');
const twitterTrendProvider = require('./providers/twitterTrendProvider');
const instagramSignalProvider = require('./providers/instagramSignalProvider');
const spotifyTrendProvider = require('./providers/spotifyTrendProvider');
const staticFallbackProvider = require('./providers/staticFallbackProvider');
const { normalizeNiche, normalizeRegion, normalizeScope } = require('./trendTaxonomy');
const { cleanTrendText, sanitizeSignal, dedupeSignals, calculateCreatorRelevance, classifyTrend, TREND_TYPE_PRIORITIES, calculateQualityScore, abstractTrendTopic } = require('./trendSanitizer');

const NICHE_PRIORITIES = {
  'photography': { primary: ['google-trends', 'youtube'], secondary: [], deprioritized: ['twitter', 'spotify', 'instagram'] },
  'filmmaking': { primary: ['google-trends', 'youtube'], secondary: [], deprioritized: ['twitter', 'spotify', 'instagram'] },
  'gaming': { primary: ['google-trends', 'youtube'], secondary: ['twitter'], deprioritized: ['spotify', 'instagram'] },
  'geopolitics': { primary: ['google-trends', 'youtube', 'twitter'], secondary: [], deprioritized: ['spotify', 'instagram'] },
  'ai & technology': { primary: ['google-trends', 'youtube', 'twitter'], secondary: [], deprioritized: ['spotify', 'instagram'] },
  'business & finance': { primary: ['google-trends', 'youtube', 'twitter'], secondary: [], deprioritized: ['spotify', 'instagram'] },
  'fitness': { primary: ['google-trends', 'youtube'], secondary: [], deprioritized: ['twitter', 'spotify', 'instagram'] },
  'travel': { primary: ['google-trends', 'youtube'], secondary: [], deprioritized: ['twitter', 'spotify', 'instagram'] },
  'food': { primary: ['google-trends', 'youtube'], secondary: [], deprioritized: ['twitter', 'spotify', 'instagram'] },
  'sports': { primary: ['google-trends', 'youtube', 'twitter'], secondary: [], deprioritized: ['spotify', 'instagram'] },
  'music': { primary: ['spotify', 'google-trends', 'youtube'], secondary: [], deprioritized: ['twitter', 'instagram'] },
  'movies & entertainment': { primary: ['google-trends', 'youtube'], secondary: ['twitter'], deprioritized: ['spotify', 'instagram'] },
  'default': { primary: ['google-trends', 'youtube'], secondary: ['twitter'], deprioritized: ['spotify', 'instagram'] }
};

function generateId(title) {
  return 'tr_' + crypto.createHash('md5').update(title).digest('hex').substring(0, 10);
}

function extractJsonArray(content) {
  if (!content) return null;
  let s = String(content).trim().replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  let jsonStr = s.substring(start, end + 1).replace(/,\s*([\]}])/g, '$1'); // strip trailing commas
  try { return JSON.parse(jsonStr); } catch { return null; }
}

async function askClaude(prompt) {
  // Routes to the configured provider (Gemini/Claude). Retries once on a parse
  // failure — Gemini occasionally emits slightly-malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await llm.complete(prompt, { maxTokens: 4000, tier: 'fast' });
    const parsed = extractJsonArray(content);
    if (Array.isArray(parsed)) return parsed;
    if (attempt === 0) {
      prompt += '\n\nIMPORTANT: your previous reply was not valid JSON. Reply with ONLY a valid JSON array — no markdown fences, no commentary.';
      continue;
    }
    console.error('LLM output that failed to parse:', String(content).slice(0, 300));
  }
  throw new Error('Failed to parse LLM response as JSON');
}

// Map provider signals to the final trend schema without inventing trend titles.
function programmaticSynthesizeTrends(filteredData, niche, region, scope) {
  const allItems = [];

  for (const provider of Object.keys(filteredData)) {
    const items = filteredData[provider] || [];
    for (const item of items) {
      const sanitized = sanitizeSignal(item, niche);
      if (!sanitized) continue;

      const title = sanitized.title;
      const description = sanitized.description || item.snippet || '';

      // 1. Calculate Quality Score (Quality Gate)
      const qualityScore = calculateQualityScore(title, description, scope);
      if (qualityScore < 40) continue; // Drop signal entirely if low quality

      // 3. Calculate creator relevance score (0-100) using raw title for key matches
      const creatorRelevanceScore = calculateCreatorRelevance(title, description, niche, scope);
      if (creatorRelevanceScore <= 20) continue; // Drop heavily penalized news items

      // 4. Classify trend type (Tutorial, Challenge, Tool, etc.)
      const trendType = classifyTrend(title, description);

      // 5. Compute base raw score (normalized per-source below)
      const baseScore = sanitized.sourceScore || sanitized.viewCount || sanitized.value || sanitized.popularity || 0;

      allItems.push({
        ...sanitized,
        _originalTitle: title,
        _sourceProvider: provider,
        _creatorRelevanceScore: creatorRelevanceScore,
        _trendType: trendType,
        _qualityScore: qualityScore,
        _baseScore: baseScore,
        _relMult: creatorRelevanceScore / 50.0,
        _typeWeight: TREND_TYPE_PRIORITIES[trendType] || 1.0,
        _qualMult: qualityScore / 100.0,
      });
    }
  }

  // Normalize the raw popularity score WITHIN each provider, so a top YouTube
  // video (millions of views) doesn't automatically outrank a top local Google
  // Trends search. This lets genuinely-local signals surface for every country
  // instead of only globally-viral YouTube content.
  const maxByProvider = {};
  for (const it of allItems) {
    maxByProvider[it._sourceProvider] = Math.max(maxByProvider[it._sourceProvider] || 0, it._baseScore || 0);
  }
  // Source weighting: LOCAL favours geo-specific Google Trends/News (most local);
  // GLOBAL favours YouTube (worldwide virality).
  const SOURCE_WEIGHT = scope === 'global'
    ? { 'google-trends': 1.0,  youtube: 1.25, twitter: 0.9, spotify: 1.0 }
    : { 'google-trends': 1.35, youtube: 1.0,  twitter: 0.9, spotify: 1.0 };
  for (const it of allItems) {
    const norm = (it._baseScore || 0) / (maxByProvider[it._sourceProvider] || 1); // 0..1 within source
    const weight = SOURCE_WEIGHT[it._sourceProvider] || 1.0;
    it._rankScore = (0.2 + norm) * weight * it._relMult * it._typeWeight * it._qualMult;
  }

  const selectedItems = dedupeSignals(allItems)
    .sort((a, b) => (b._rankScore || 0) - (a._rankScore || 0))
    .slice(0, 10);

  return selectedItems.map(item => {
    const title = cleanTrendText(item.title || item.query || item.topic || item.name || item.artist);
    let description = cleanTrendText(item.description || item.snippet || '');

    if (!description) {
      if (item._sourceProvider === 'youtube') description = `Popular recent YouTube signal for ${niche} in ${region}.`;
      else if (item._sourceProvider === 'google-trends') description = `Google Trends is showing search interest for this ${niche} topic in ${region}.`;
      else if (item._sourceProvider === 'spotify') description = `Spotify viral audio signal for music creators in ${region}.`;
      else if (item._sourceProvider === 'twitter') description = `Fast-moving public conversation in the ${niche} space.`;
      else description = `Live provider signal in the ${niche} space.`;
    }

    let keywords = item.keywords || item.tags || [];
    if (!Array.isArray(keywords)) keywords = [];
    if (item.query) keywords.push(item.query);
    if (item.artist) keywords.push(item.artist);
    if (keywords.length === 0) keywords = [niche.toLowerCase(), item._sourceProvider];

    return {
      title,
      description,
      keywords: [...new Set(keywords.map(cleanTrendText).filter(Boolean))].slice(0, 5),
      category: item.category || niche,
      sources: [item._sourceProvider],
      evidence: [{
        source: item._sourceProvider,
        title: item._originalTitle || title, // original title for evidence
        value: item.value || item.viewCount || item.popularity || undefined,
        growth: item.growth || undefined,
        channelTitle: item.channelTitle || undefined,
        publishedAt: item.publishedAt || undefined,
      }],
      confidence: item.growth === 'exploding' || item.viewCount > 100000 ? 'High' : 'Medium',
      nicheRelevanceScore: 95,
      creatorRelevanceScore: item._creatorRelevanceScore,
      trendType: item._trendType,
      qualityScore: item._qualityScore,
    };
  });
}
async function getTrendsV2(region, niche, scope = 'local') {
  const normalizedNiche = normalizeNiche(niche);
  const normalizedRegion = normalizeRegion(region);
  const normalizedScope = normalizeScope(scope, normalizedRegion);
  const priorities = NICHE_PRIORITIES[normalizedNiche] || NICHE_PRIORITIES['default'];
  
  const queryRegion = normalizedScope === 'global' ? 'Global' : normalizedRegion;
  const [googleData, youtubeData, twitterData, spotifyData] = await Promise.all([
    googleTrendProvider.fetchTrends(queryRegion, normalizedNiche).catch(() => []),
    youtubeTrendProvider.fetchTrends(queryRegion, normalizedNiche).catch(() => []),
    twitterTrendProvider.fetchTrends(queryRegion, normalizedNiche).catch(() => []),
    normalizedNiche === 'music' ? spotifyTrendProvider.fetchTrends(queryRegion, normalizedNiche).catch(() => []) : Promise.resolve([])
  ]);

  const rawData = {
    'google-trends': googleData,
    'youtube': youtubeData,
    'twitter': twitterData,
    'spotify': spotifyData
  };

  // For Global, drop anything that is ALSO trending locally in India, so the
  // Global tab stays distinct from Local — even for globally-viral Indian
  // content (e.g. a Punjabi song trending in both US/UK and India).
  if (normalizedScope === 'global') {
    try {
      // Exclude whatever is trending in the user's OWN country (their Local tab).
      const localRegion = (normalizedRegion && normalizedRegion !== 'Global') ? normalizedRegion : 'India';
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      const [inYt, inGg] = await Promise.all([
        youtubeTrendProvider.fetchTrends(localRegion, normalizedNiche).catch(() => []),
        googleTrendProvider.fetchTrends(localRegion, normalizedNiche).catch(() => []),
      ]);
      const localItems = [...inYt, ...inGg].map(it => norm(it.title)).filter(Boolean);
      const localWordSets = localItems.map(t => new Set(t.split(' ').filter(w => w.length > 3)));
      const isLocal = (title) => {
        const t = norm(title);
        if (!t) return false;
        if (localItems.includes(t)) return true;
        const w = new Set(t.split(' ').filter(x => x.length > 3));
        return localWordSets.some(ls => [...w].filter(x => ls.has(x)).length >= 2);
      };
      for (const prov of Object.keys(rawData)) {
        rawData[prov] = (rawData[prov] || []).filter(it => !isLocal(it.title));
      }
    } catch (e) { /* if the India comparison fetch fails, keep global as-is */ }
  }

  // FIX 1: Enforce Niche Priorities
  const priorityData = {};
  const allowedProviders = [...priorities.primary, ...priorities.secondary];
  let hasProviderData = false;
  
  for (const provider of allowedProviders) {
    if (rawData[provider] && rawData[provider].length > 0) {
      priorityData[provider] = rawData[provider];
      hasProviderData = true;
    }
  }

  // If we have absolutely no priority provider data, use static fallback
  if (!hasProviderData) {
    console.log(`[TrendEngineV2] No priority provider data found for ${normalizedNiche}, falling back to static.`);
    return staticFallbackProvider.getStaticFallback(normalizedNiche, normalizedRegion, normalizedScope);
  }

  // We are skipping the Claude filterRawSignals step to ensure it runs even when Claude is down/out of credits
  // If you wish, you can add a try-catch around filterRawSignals and fall back to priorityData
  const filteredData = priorityData;

  // 2. Synthesize Programmatically FIRST
  let synthesizedTrends = programmaticSynthesizeTrends(filteredData, normalizedNiche, normalizedRegion, normalizedScope);
  
  if (synthesizedTrends.length === 0) {
     return staticFallbackProvider.getStaticFallback(normalizedNiche, normalizedRegion, normalizedScope);
  }

  // Clean up titles via the LLM. We send ONLY the titles/descriptions (tiny
  // payload) — sending the full objects was slow and the model often corrupted
  // the large JSON, which dropped us back to raw clickbait titles.
  if (synthesizedTrends.length > 0) {
    try {
      const slim = synthesizedTrends.map((t, i) => ({ i, title: t.title, description: t.description || '' }));
      const prompt = `You are a social-media trend editor. Below is a JSON array of REAL trends from live YouTube and Google Trends data.
For EACH item, rewrite "title" into a clean, specific, headline-style topic (about 4-9 words) reflecting what is ACTUALLY trending:
- Remove clickbait, ALL-CAPS, emojis, channel names, hashtags, publisher suffixes and filler ("I BOUGHT...", "you won't believe", "(MUST WATCH)", "GONE WRONG").
- KEEP it specific and concrete — preserve real names, events, products, places, teams and numbers. Do NOT flatten into a vague category (avoid "Sports News", "Fitness Content", "Demand For X Is Rising").
- If the title is NOT in English (e.g. Japanese, Korean, Arabic), TRANSLATE it into clear, natural English while keeping proper nouns.
- Rewrite "description" to one short factual sentence on what the trend is and why it's a good short-form video topic.
Return ONLY a JSON array, each item exactly {"i": <same index number>, "title": "...", "description": "..."} — same length and order.
Input: ${JSON.stringify(slim)}`;

      const enriched = await askClaude(prompt);
      if (Array.isArray(enriched) && enriched.length) {
        const byIndex = {};
        enriched.forEach((e, k) => { const idx = (e && Number.isInteger(e.i)) ? e.i : k; byIndex[idx] = e; });
        synthesizedTrends = synthesizedTrends.map((trend, index) => {
          const e = byIndex[index] || {};
          return {
            ...trend,
            title: cleanTrendText(e.title) || trend.title,
            description: cleanTrendText(e.description) || trend.description,
          };
        });
      }
    } catch (err) {
      console.log('[TrendEngineV2] Trend title enrichment failed, using cleaned raw titles.');
    }
  }

  // 3. Instagram Validation Layer (Keep if it works without Claude)
  let instaValidations = {};
  try {
     instaValidations = await instagramSignalProvider.validateTrends(synthesizedTrends, normalizedNiche);
  } catch (err) {
     console.log("[TrendEngineV2] Instagram validation failed, continuing...");
  }
  
  // 4. Apply validation & evidence formatting
  const finalTrends = synthesizedTrends.map(trend => {
    let finalConfidence = trend.confidence || 'Medium';
    const sources = new Set(trend.sources || []);
    
    // Add instagram if validated
    if (instaValidations[trend.title]) {
      sources.add('instagram');
      finalConfidence = 'High'; // Confidence bonus
    }

    return {
      id: generateId(trend.title),
      title: trend.title || 'Unknown Trend',
      description: trend.description || '',
      keywords: trend.keywords || [],
      category: trend.category || normalizedNiche,
      region: normalizedRegion,
      scope: normalizedScope,
      niche: normalizedNiche,
      confidence: finalConfidence,
      sources: Array.from(sources),
      evidence: trend.evidence || [],
      nicheRelevanceScore: trend.nicheRelevanceScore || 80,
      creatorRelevanceScore: trend.creatorRelevanceScore || 80,
      trendType: trend.trendType || 'Discussion',
      createdAt: new Date().toISOString()
    };
  });

  // Floor: never show fewer than 3 cards. If live providers were sparse for this
  // niche/scope, top up with static fallback so the brief never looks broken.
  if (finalTrends.length < 3) {
    try {
      const fillers = staticFallbackProvider.getStaticFallback(normalizedNiche, normalizedRegion, normalizedScope) || [];
      for (const f of fillers) {
        if (finalTrends.length >= 4) break;
        if (!finalTrends.some(t => (t.title || '').toLowerCase() === (f.title || '').toLowerCase())) {
          finalTrends.push(f);
        }
      }
    } catch (e) { /* ignore */ }
  }

  return finalTrends;
}

module.exports = { getTrendsV2 };
