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

async function askClaude(prompt) {
  // Routes to the configured provider (Gemini/Claude). 'fast' tier — title cleanup is simple.
  const content = await llm.complete(prompt, { maxTokens: 4000, tier: 'fast' });
  try {
    const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('LLM output that failed to parse:', content);
    throw new Error('Failed to parse LLM response as JSON');
  }
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

      // 2. Trend Abstraction Layer
      const abstractTitle = abstractTrendTopic(title, niche);

      // 3. Calculate creator relevance score (0-100) using raw title for key matches
      const creatorRelevanceScore = calculateCreatorRelevance(title, description, niche, scope);
      if (creatorRelevanceScore <= 20) continue; // Drop heavily penalized news items

      // 4. Classify trend type (Tutorial, Challenge, Tool, etc.)
      const trendType = classifyTrend(title, description);

      // 5. Compute base raw score
      const baseScore = sanitized.sourceScore || sanitized.viewCount || sanitized.value || sanitized.popularity || 0;

      // 6. Adjust rank score based on relevance multiplier, trend type weight, and quality score weighting
      const relevanceMultiplier = creatorRelevanceScore / 50.0;
      const typeWeight = TREND_TYPE_PRIORITIES[trendType] || 1.0;
      const qualityMultiplier = qualityScore / 100.0;
      const adjustedRankScore = baseScore * relevanceMultiplier * typeWeight * qualityMultiplier;

      allItems.push({
        ...sanitized,
        _originalTitle: title,
        title: abstractTitle, // Use abstract title as default
        _sourceProvider: provider,
        _creatorRelevanceScore: creatorRelevanceScore,
        _trendType: trendType,
        _rankScore: adjustedRankScore,
        _qualityScore: qualityScore,
      });
    }
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

  // Use Claude to extract the broad topic title and move specific viral video references to the description.
  if (true) { // Always enable Claude enrichment to fix the viral video clickbait issue
    try {
      const prompt = `You are a social media trend analyzer. You will be given an array of trend objects.
Some of these trends are derived from specific viral YouTube videos with clickbait or overly specific titles (e.g., "I BOUGHT A NEW CAMERA!", or "This video is getting viral").
Your job is to:
1. Change the 'title' to be the broad, generic topic being discussed (e.g., "New Camera Gear Trends", "Fitness Diet Hacks").
2. Change the 'description' to briefly explain the trend, and you may mention that a specific video about this is currently going viral.
Do NOT change the evidence array or any other IDs.
Return ONLY a valid JSON array of objects with the updated 'title' and 'description' fields corresponding to the input array: ${JSON.stringify(synthesizedTrends)}`;

      const enrichedTrends = await askClaude(prompt);
      if (Array.isArray(enrichedTrends) && enrichedTrends.length > 0) {
        synthesizedTrends = synthesizedTrends.map((trend, index) => ({
          ...trend,
          title: cleanTrendText(enrichedTrends[index]?.title) || trend.title,
          description: cleanTrendText(enrichedTrends[index]?.description) || trend.description,
        }));
      }
    } catch (err) {
      console.log('[TrendEngineV2] Claude description enrichment failed or skipped.');
      console.error(err.message || err);
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

  return finalTrends;
}

module.exports = { getTrendsV2 };
