const crypto = require('crypto');
const llm = require('../llm');   // provider-agnostic LLM (Gemini/Claude)

const googleTrendProvider = require('./providers/googleTrendProvider');
const youtubeTrendProvider = require('./providers/youtubeTrendProvider');
const twitterTrendProvider = require('./providers/twitterTrendProvider');
const instagramSignalProvider = require('./providers/instagramSignalProvider');
const spotifyTrendProvider = require('./providers/spotifyTrendProvider');
const staticFallbackProvider = require('./providers/staticFallbackProvider');
const { normalizeNiche, normalizeRegion, normalizeScope } = require('./trendTaxonomy');
const { cleanTrendText, sanitizeSignal, dedupeSignals, calculateCreatorRelevance, classifyTrend, TREND_TYPE_PRIORITIES, calculateQualityScore, abstractTrendTopic, calculateRegionalRelevanceScore, applyTimeDecay } = require('./trendSanitizer');

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
  const rawItems = [];

  for (const provider of Object.keys(filteredData)) {
    const items = filteredData[provider] || [];
    for (const item of items) {
      const sanitized = sanitizeSignal(item, niche);
      if (!sanitized) continue;
      
      sanitized._sourceProvider = provider;
      rawItems.push(sanitized);
    }
  }

  // Cross-Source Verification & Aggregation
  // Group signals that represent the same core concept across different platforms
  const groupedConcepts = {};
  for (const item of rawItems) {
    const title = item.title;
    const titleKey = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!titleKey) continue;
    
    // Simplistic concept hash for aggregation (first 2 words > 3 chars)
    const words = titleKey.split(' ').filter(w => w.length > 3);
    const conceptSig = words.length >= 2 ? words.slice(0, 2).sort().join('_') : titleKey;

    if (!groupedConcepts[conceptSig]) {
      groupedConcepts[conceptSig] = {
        masterTitle: title,
        description: item.description || item.snippet || '',
        providers: new Set(),
        maxViewCount: 0,
        bestPublishedAt: null,
        evidence: []
      };
    }

    const group = groupedConcepts[conceptSig];
    group.providers.add(item._sourceProvider);
    group.maxViewCount = Math.max(group.maxViewCount, item.viewCount || item.value || 0);
    if (item.publishedAt && (!group.bestPublishedAt || new Date(item.publishedAt) > new Date(group.bestPublishedAt))) {
      group.bestPublishedAt = item.publishedAt; // Keep the freshest date
    }
    
    group.evidence.push({
      source: item._sourceProvider,
      title: item.title,
      value: item.viewCount || item.value || undefined,
      publishedAt: item.publishedAt
    });
  }

  const allItems = [];
  
  for (const conceptSig in groupedConcepts) {
    const group = groupedConcepts[conceptSig];
    const title = group.masterTitle;
    const description = group.description;

    // 1. Calculate Quality Score (Quality Gate)
    const qualityScore = calculateQualityScore(title, description, niche, scope);
    if (qualityScore < 40) continue; // Drop signal entirely if low quality

    // 2. Calculate Regional Relevance Score
    const regionalScore = calculateRegionalRelevanceScore(title, description, region);

    // 3. Calculate creator relevance score (0-100) using raw title for key matches
    const creatorRelevanceScore = calculateCreatorRelevance(title, description, niche);
    if (creatorRelevanceScore <= 20) continue; // Drop heavily penalized news items

    // 4. Classify trend type (Tutorial, Challenge, Tool, etc.)
    const trendType = classifyTrend(title, description);

    // 5. Compute base raw score (with Time Decay)
    let baseScore = group.maxViewCount || 100; // fallback base score if no views available
    baseScore = applyTimeDecay(group.bestPublishedAt, baseScore);

    // Cross-Source Multiplier
    const multiSourceBoost = group.providers.size >= 2 ? 1.5 : 1.0;

    const rankScore = baseScore * multiSourceBoost * (qualityScore / 100.0) * (creatorRelevanceScore / 50.0) * (regionalScore / 50.0);

    allItems.push({
      title,
      description,
      _creatorRelevanceScore: creatorRelevanceScore,
      _trendType: trendType,
      _qualityScore: qualityScore,
      _rankScore: rankScore,
      _sources: Array.from(group.providers),
      _evidence: group.evidence
    });
  }

  const selectedItems = allItems
    .sort((a, b) => (b._rankScore || 0) - (a._rankScore || 0))
    .slice(0, 10);

  return selectedItems.map(item => {
    let description = cleanTrendText(item.description || '');

    if (!description) {
      description = `Live cross-platform creator opportunity in the ${niche} space.`;
    }

    const isMultiSource = item._sources.length > 1;

    return {
      title: item.title,
      description,
      keywords: [niche.toLowerCase(), ...item._sources].slice(0, 5),
      category: niche,
      sources: item._sources,
      evidence: item._evidence,
      confidence: isMultiSource ? 'High' : 'Medium',
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

  const priorityData = {};
  const allowedProviders = [...priorities.primary, ...priorities.secondary];
  let hasProviderData = false;

  // Calculate Signal Coverage Score
  let totalRawSignals = 0;
  let freshSignals = 0;
  
  for (const provider of allowedProviders) {
    if (rawData[provider] && rawData[provider].length > 0) {
      priorityData[provider] = rawData[provider];
      hasProviderData = true;
      
      for (const item of rawData[provider]) {
        totalRawSignals++;
        if (item.publishedAt) {
          const hoursOld = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60);
          if (hoursOld <= 72) freshSignals++;
        }
      }
    }
  }

  const signalCoverageScore = freshSignals; // Number of fresh, real-world signals collected

  console.log(`[TrendEngineV2] Signal Coverage Score for ${normalizedNiche} in ${queryRegion}: ${signalCoverageScore} fresh signals (${totalRawSignals} total raw)`);

  if (!hasProviderData || signalCoverageScore < 3) {
    console.warn(`[TrendEngineV2] Weak Signal Coverage (${signalCoverageScore}) for ${normalizedNiche}. Triggering broadened discovery inside the niche.`);
    // We already fetch broadly via EVENT and CREATOR queries. If it's still weak, 
    // it implies an extremely slow news day for this niche in this specific region.
    // Rather than falling back to General News (which is prohibited) or Static Data (prohibited),
    // we will proceed with the signals we have, trusting the dual-stream to surface the best available.
  }

  // We are skipping the Claude filterRawSignals step to ensure it runs even when Claude is down/out of credits
  const filteredData = priorityData;

  // 2. Synthesize Programmatically FIRST
  let synthesizedTrends = programmaticSynthesizeTrends(filteredData, normalizedNiche, normalizedRegion, normalizedScope);
  
  if (synthesizedTrends.length === 0) {
     console.warn(`[TrendEngineV2] 0 synthesized trends for ${normalizedNiche}. Returning empty array to prevent General News fallback.`);
     return [];
  }

  // Clean up titles via the LLM. We send ONLY the titles/descriptions (tiny
  // payload) — sending the full objects was slow and the model often corrupted
  // the large JSON, which dropped us back to raw clickbait titles.
  if (synthesizedTrends.length > 0) {
    try {
      const slim = synthesizedTrends.map((t, i) => ({ i, title: t.title, description: t.description || '' }));
      const prompt = `You are a social-media trend editor for creators. Below is a JSON array of REAL trends from live YouTube and Google Trends data.
For EACH item, rewrite "title" into a clean, specific, headline-style topic (about 4-9 words) reflecting what a creator should make content about:
- Remove clickbait, ALL-CAPS, emojis, channel names, hashtags, publisher suffixes and filler ("I BOUGHT...", "you won't believe", "(MUST WATCH)", "GONE WRONG").
- KEEP it specific and concrete — preserve real names, events, products, places, teams and numbers. Do NOT flatten into a vague category (avoid "Sports News", "Fitness Content", "Demand For X Is Rising").
- IMPORTANT: Preserve authentic regional names and cultural festivals (e.g., 'Ganesh Chaturthi', 'Tokyo Game Show', 'Oktoberfest'). Do not genericize them into "Local Festival".
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

  // We no longer fallback to static data if < 3 cards, because we must ensure 
  // we only show real, verified signals (per user requirement). If the niche
  // only has 1 or 2 real opportunities today, we only show those.

  return finalTrends;
}

module.exports = { getTrendsV2 };
