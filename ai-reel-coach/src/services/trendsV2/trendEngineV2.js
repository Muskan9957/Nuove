const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const googleTrendProvider = require('./providers/googleTrendProvider');
const youtubeTrendProvider = require('./providers/youtubeTrendProvider');
const twitterTrendProvider = require('./providers/twitterTrendProvider');
const instagramSignalProvider = require('./providers/instagramSignalProvider');
const spotifyTrendProvider = require('./providers/spotifyTrendProvider');
const staticFallbackProvider = require('./providers/staticFallbackProvider');

const NICHE_PRIORITIES = {
  'photography': { primary: ['youtube'], secondary: ['instagram'], deprioritized: ['twitter', 'google-trends', 'spotify'] },
  'filmmaking': { primary: ['youtube'], secondary: ['instagram'], deprioritized: ['twitter', 'google-trends', 'spotify'] },
  'geopolitics': { primary: ['twitter'], secondary: ['google-trends'], deprioritized: ['youtube', 'instagram', 'spotify'] },
  'ai & technology': { primary: ['google-trends', 'twitter'], secondary: ['youtube'], deprioritized: ['spotify', 'instagram'] },
  'finance': { primary: ['google-trends'], secondary: ['twitter', 'youtube'], deprioritized: ['spotify', 'instagram'] },
  'music': { primary: ['spotify', 'youtube'], secondary: ['instagram'], deprioritized: ['twitter', 'google-trends'] },
  'default': { primary: ['youtube', 'google-trends'], secondary: ['twitter'], deprioritized: ['spotify', 'instagram'] }
};

function generateId(title) {
  return 'tr_' + crypto.createHash('md5').update(title).digest('hex').substring(0, 10);
}

async function askClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not defined in the environment.');
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });
  const content = response.content[0].text;
  try {
    const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Claude output that failed to parse:', content);
    throw new Error('Failed to parse Claude response as JSON');
  }
}

// Map raw signals to the final trend schema programmatically without Claude
function programmaticSynthesizeTrends(filteredData, niche, region) {
  const synthesized = [];
  
  // Create a combined list of all items, tagging them with their source provider
  const allItems = [];
  for (const provider of Object.keys(filteredData)) {
    const items = filteredData[provider] || [];
    for (const item of items) {
      allItems.push({ ...item, _sourceProvider: provider });
    }
  }

  // Very basic programmatic deduction
  // 1. Sort by some logic if possible, else take first 10
  // Here we just take up to 10 items
  const selectedItems = allItems.slice(0, 10);

  for (const item of selectedItems) {
    // Generate a clean title
    const title = item.title || item.topic || item.name || 'Trending Topic';
    
    // Generate description
    let description = item.description || item.snippet || '';
    if (!description) {
      if (item._sourceProvider === 'youtube') description = `A popular trending video in ${niche}: ${title}.`;
      else if (item._sourceProvider === 'google-trends') description = `High search interest detected for ${title}.`;
      else description = `A rising trend in the ${niche} space.`;
    }

    // Extract keywords
    let keywords = item.keywords || item.tags || [];
    if (!Array.isArray(keywords)) keywords = [];
    if (keywords.length === 0) keywords = [niche.toLowerCase(), item._sourceProvider];

    synthesized.push({
      title: title,
      description: description,
      keywords: keywords,
      category: item.category || niche,
      sources: [item._sourceProvider],
      evidence: [{ source: item._sourceProvider, title: title }],
      confidence: 'Medium',
      nicheRelevanceScore: 85 // Programmatically assume reasonably relevant if it came from niche search
    });
  }

  return synthesized;
}

async function getTrendsV2(region, niche) {
  const priorities = NICHE_PRIORITIES[niche.toLowerCase()] || NICHE_PRIORITIES['default'];
  
  // 1. Fetch raw data from discoverable providers
  const [googleData, youtubeData, twitterData, spotifyData] = await Promise.all([
    googleTrendProvider.fetchTrends(region, niche).catch(() => []),
    youtubeTrendProvider.fetchTrends(region, niche).catch(() => []),
    twitterTrendProvider.fetchTrends(region, niche).catch(() => []),
    spotifyTrendProvider.fetchTrends(region, niche).catch(() => [])
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
    console.log(`[TrendEngineV2] No priority provider data found for ${niche}, falling back to static.`);
    return staticFallbackProvider.getStaticFallback(niche, region);
  }

  // We are skipping the Claude filterRawSignals step to ensure it runs even when Claude is down/out of credits
  // If you wish, you can add a try-catch around filterRawSignals and fall back to priorityData
  const filteredData = priorityData;

  // 2. Synthesize Programmatically FIRST
  let synthesizedTrends = programmaticSynthesizeTrends(filteredData, niche, region);
  
  if (synthesizedTrends.length === 0) {
     return staticFallbackProvider.getStaticFallback(niche, region);
  }

  // Optional: Enrich with Claude if available
  try {
     const prompt = `You are TrendEngineV2. Analyze these programmatically synthesized trends for the EXACT niche '${niche}' in region '${region}'.
Synthesized Data: ${JSON.stringify(synthesizedTrends)}

Rules for enrichment:
1. Improve titles to be catchy and clear.
2. Improve descriptions to be exactly 1 short sentence explaining why this is trending.
3. Keep the original 'evidence' and 'sources' arrays intact.
4. Output JSON array of objects.

JSON format:
[
  {
    "title": "Improved Trend Title",
    "description": "1 short sentence explaining the trend.",
    "keywords": ["tag1", "tag2"],
    "category": "Niche specific category",
    "sources": ["youtube", "google-trends"],
    "evidence": [ { "source": "youtube", "title": "original title" } ],
    "confidence": "Medium",
    "nicheRelevanceScore": 95
  }
]`;

    const enrichedTrends = await askClaude(prompt);
    if (enrichedTrends && enrichedTrends.length > 0) {
        synthesizedTrends = enrichedTrends;
    }
  } catch (err) {
      console.log("[TrendEngineV2] Claude enrichment failed or skipped, proceeding with programmatic trends.");
  }

  // 3. Instagram Validation Layer (Keep if it works without Claude)
  let instaValidations = {};
  try {
     instaValidations = await instagramSignalProvider.validateTrends(synthesizedTrends, niche);
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
      category: trend.category || niche,
      region,
      niche,
      confidence: finalConfidence,
      sources: Array.from(sources),
      evidence: trend.evidence || [],
      nicheRelevanceScore: trend.nicheRelevanceScore || 80,
      createdAt: new Date().toISOString()
    };
  });

  return finalTrends;
}

module.exports = { getTrendsV2 };