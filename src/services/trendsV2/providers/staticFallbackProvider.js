const crypto = require('crypto')
const { normalizeNiche, normalizeRegion, normalizeScope } = require('../trendTaxonomy')
const { classifyTrend, calculateCreatorRelevance } = require('../trendSanitizer')

const NICHE_PROFILES = {
  'ai & technology': {
    category: 'AI & Technology',
    keywords: ['OpenAI', 'Claude', 'Gemini', 'AI tools', 'agents', 'automation'],
    titles: ['OpenAI Agent Workflows', 'Claude Prompt Systems', 'Gemini App Integrations', 'AI Video Editing Tools', 'No-Code AI Automations', 'On-Device AI Features', 'AI Coding Assistants', 'AI Search Rewrites', 'Creator AI Tool Stacks', 'AI Productivity Experiments'],
  },
  gaming: {
    category: 'Gaming',
    keywords: ['gaming', 'console', 'streaming', 'esports', 'walkthroughs', 'mods'],
    titles: ['GTA 6 Trailer Breakdowns', 'Fortnite Meta Loadouts', 'Minecraft Hardcore Builds', 'Valorant Aim Routines', 'Mobile Gaming Setups', 'Esports Watch Parties', 'Indie Horror Game Clips', 'Game Pass Hidden Gems', 'Streamer Challenge Formats', 'Controller vs Keyboard Debates'],
  },
  'business & finance': {
    category: 'Business & Finance',
    keywords: ['investing', 'stock market', 'startups', 'entrepreneurship', 'venture capital', 'funding', 'SaaS', 'personal finance', 'crypto', 'business growth', 'market trends'],
    titles: ['Stock Market Earnings Season', 'Crypto ETF Watch', 'SIP Portfolio Reviews', 'Personal Finance Hacks', 'Startup Funding Round Explainers', 'Founder Pitch Deck Reviews', 'SaaS Growth Experiments', 'Venture Capital Investing', 'Entrepreneurship Productivity Rules', 'Business Growth and Market Trends'],
  },
  fitness: {
    category: 'Fitness',
    keywords: ['workout', 'gym', 'protein', 'fat loss', 'mobility', 'recovery'],
    titles: ['Push Pull Legs Routine', 'High Protein Indian Meals', 'Fat Loss Walking Challenges', 'Mobility Reset Routines', 'Home Dumbbell Workouts', 'Creatine Explainers', 'Beginner Gym Mistakes', 'Sleep and Recovery Tracking', 'Desk Worker Stretch Plans', '30-Day Core Challenges'],
  },
  photography: {
    category: 'Photography',
    keywords: ['camera', 'editing', 'Lightroom', 'portraits', 'lenses', 'composition'],
    titles: ['Lightroom Portrait Color Grading', 'iPhone vs Mirrorless Camera Tests', 'Street Photography POV Walks', 'Golden Hour Portrait Setups', 'Budget Lens Comparisons', 'Cinematic Photo Edits', 'Flash Photography Basics', 'Wedding Shot Lists', 'Film Camera Comebacks', 'Composition Mistakes to Fix'],
  },
  filmmaking: {
    category: 'Filmmaking',
    keywords: ['cinematography', 'B-roll', 'CapCut', 'Premiere', 'lighting', 'storyboard'],
    titles: ['Cinematic B-Roll Sequences', 'CapCut Mobile Editing Workflows', 'Zero Budget Lighting Setups', 'Short Film Storyboarding', 'Reel Shot List Templates', 'Color Grading Before After', 'Phone Filmmaking Rigs', 'Sound Design for Shorts', 'Talking Head Lighting', 'Premiere Speed Ramp Edits'],
  },
  geopolitics: {
    category: 'Geopolitics',
    keywords: ['elections', 'diplomacy', 'defense', 'trade', 'policy', 'security'],
    titles: ['Election Map Explainers', 'Defense Deal Breakdowns', 'Diplomacy Summit Recaps', 'Trade Route Tensions', 'Semiconductor Policy Shifts', 'Border Security Updates', 'Energy Corridor Politics', 'Military Tech Comparisons', 'Global Sanctions Explained', 'Regional Alliance Changes'],
  },
  travel: {
    category: 'Travel',
    keywords: ['hidden beaches', 'unexplored trek', 'budget travel', 'travel hacks', 'hidden gems', 'vlog'],
    titles: ['Hidden Beaches and secret viewpoints', 'The mountain trek no one talks about', 'Secret waterfalls and hikes', 'Offbeat locations and travel itineraries', 'Budget backpacking route guides', 'Solo adventure travel hacks', 'Hidden cafes and viewpoints', 'Local street food trail maps', 'Road trip planning tips', 'Unexplored village treks'],
  },
  food: {
    category: 'Food',
    keywords: ['recipes', 'street food', 'meal prep', 'cooking', 'restaurant', 'snacks'],
    titles: ['High Protein Street Food Swaps', '15 Minute Dinner Recipes', 'Regional Thali Reviews', 'Cloud Kitchen Food Tests', 'Air Fryer Snack Experiments', 'Cafe Hopping Lists', 'Budget Meal Prep Boxes', 'Viral Sauce Recipes', 'Monsoon Comfort Food', 'Restaurant Copycat Recipes'],
  },
  sports: {
    category: 'Sports',
    keywords: ['football', 'cricket', 'FIFA', 'F1', 'tennis', 'league'],
    titles: ['Cricket World Cup Talking Points', 'Football Transfer Rumours', 'F1 Race Strategy Breakdowns', 'Tennis Grand Slam Upsets', 'FIFA Career Mode Debates', 'IPL Auction Predictions', 'Derby Match Reactions', 'Athlete Training Routines', 'Penalty Shootout Analysis', 'Fantasy League Picks'],
  },
  music: {
    category: 'Music',
    keywords: ['Spotify', 'viral songs', 'reels audio', 'artists', 'playlists', 'remix'],
    titles: ['Viral Reels Audio Picks', 'Spotify Chart Climbers', 'Indie Artist Breakouts', 'Lo-Fi Remix Trends', 'Concert Tour Announcements', 'Music Producer Setups', 'Bollywood Hook Songs', 'Afrobeats Dance Audio', 'Playlist Curation Ideas', 'Mashup Challenge Tracks'],
  },
  'movies & entertainment': {
    category: 'Movies & Entertainment',
    keywords: ['trailers', 'OTT', 'box office', 'actors', 'reviews', 'series'],
    titles: ['OTT Release Weekend Watchlist', 'Trailer Breakdown Threads', 'Box Office Collection Debates', 'Actor Comeback Stories', 'Post-Credit Scene Explainers', 'K-Drama Clip Trends', 'Movie Ending Theories', 'Remake Comparison Videos', 'Award Show Reactions', 'Celebrity Interview Moments'],
  },
  general: {
    category: 'General',
    keywords: ['trending', 'viral', 'creator', 'news', 'culture', 'internet'],
    titles: ['Creator Routine Resets', 'Viral Challenge Formats', 'Internet Culture Recaps', 'Weekend Watchlist Ideas', 'Productivity Reset Trends', 'Local News Explainers', 'Community Story Formats', 'Short Video Hooks', 'Trending Audio Ideas', 'Behind the Scenes Clips'],
  },
}

const REGION_CONTEXT = {
  India: ['India angle', 'rupee impact', 'Indian creators'],
  US: ['US market', 'dollar impact', 'American creators'],
  UK: ['UK angle', 'London audience', 'British creators'],
  'Middle East': ['GCC angle', 'Dubai audience', 'regional creators'],
  'Southeast Asia': ['SEA angle', 'regional audience', 'mobile-first creators'],
  Global: ['global angle', 'worldwide audience', 'cross-border creators'],
}

function idFor(parts) {
  return 'tr_static_' + crypto.createHash('md5').update(parts.join('|')).digest('hex').slice(0, 10)
}

function getStaticFallback(niche, region, scope = 'local') {
  const normalizedNiche = normalizeNiche(niche)
  const normalizedRegion = normalizeRegion(region)
  const normalizedScope = normalizeScope(scope, normalizedRegion)
  const profile = NICHE_PROFILES[normalizedNiche] || NICHE_PROFILES.general
  const regionBits = REGION_CONTEXT[normalizedRegion] || REGION_CONTEXT.Global
  const scopeLabel = normalizedScope === 'global' ? 'worldwide' : regionBits[0]

  return profile.titles.map((title, index) => {
    const regionalKeyword = regionBits[index % regionBits.length]
    const keywords = [
      ...profile.keywords.slice(index % profile.keywords.length, index % profile.keywords.length + 2),
      regionalKeyword,
    ].slice(0, 4)

    const titleText = normalizedScope === 'global' ? `Global ${title}` : `${title} in ${normalizedRegion}`
    const descriptionText = `${profile.category} creators are using this ${scopeLabel} trend for timely short-form content.`
    const calculatedType = classifyTrend(titleText, descriptionText)
    const calculatedScore = calculateCreatorRelevance(titleText, descriptionText, normalizedNiche)

    return {
      id: idFor([normalizedNiche, normalizedRegion, normalizedScope, title]),
      title: titleText,
      description: descriptionText,
      keywords,
      category: profile.category,
      region: normalizedRegion,
      scope: normalizedScope,
      niche: normalizedNiche,
      confidence: 'Low',
      sources: ['static-fallback'],
      evidence: [{
        source: 'static-fallback',
        title: `Deterministic ${profile.category} fallback for ${normalizedRegion}/${normalizedScope}`,
      }],
      nicheRelevanceScore: 100,
      creatorRelevanceScore: Math.max(85, calculatedScore),
      trendType: calculatedType,
      createdAt: new Date().toISOString(),
    }
  })
}

module.exports = { getStaticFallback, NICHE_PROFILES }
