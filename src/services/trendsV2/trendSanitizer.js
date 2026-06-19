const { normalizeNiche } = require('./trendTaxonomy')

const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '-',
  '&mdash;': '—',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
}

const NICHE_TERMS = {
  'ai & technology': ['ai', 'artificial intelligence', 'openai', 'chatgpt', 'claude', 'gemini', 'llm', 'agent', 'automation', 'robot', 'tech', 'technology', 'app', 'software', 'coding', 'developer', 'startup', 'google', 'microsoft', 'apple', 'nvidia'],
  gaming: ['game', 'gaming', 'gamer', 'playstation', 'xbox', 'nintendo', 'pc', 'mobile', 'esports', 'valorant', 'fortnite', 'minecraft', 'gta', 'pubg', 'bgmi', 'roblox', 'streamer'],
  'business & finance': ['business', 'finance', 'startup', 'startups', 'founder', 'funding', 'saas', 'entrepreneur', 'entrepreneurship', 'company', 'brand', 'marketing', 'sales', 'revenue', 'pitch', 'investor', 'valuation', 'd2c', 'growth', 'business growth', 'stock', 'stocks', 'stock market', 'market', 'market trends', 'crypto', 'bitcoin', 'ethereum', 'earnings', 'economy', 'inflation', 'rate', 'fed', 'rbi', 'rupee', 'dollar', 'ipo', 'investment', 'investing', 'mutual fund', 'sip', 'tax', 'budget', 'bank', 'trading', 'venture capital', 'personal finance'],
  fitness: ['fitness', 'workout', 'gym', 'training', 'protein', 'diet', 'fat loss', 'weight loss', 'muscle', 'running', 'yoga', 'mobility', 'strength', 'bodybuilding', 'exercise', 'health'],
  photography: ['photo', 'photography', 'camera', 'canon', 'nikon', 'sony', 'fujifilm', 'lightroom', 'photoshop', 'portrait', 'lens', 'editing', 'street photography', 'wedding photography', 'dslr', 'mirrorless', 'iphone camera'],
  filmmaking: ['film', 'filmmaking', 'cinematic', 'cinematography', 'video', 'b-roll', 'premiere', 'capcut', 'davinci', 'after effects', 'editing', 'camera', 'lighting', 'short film', 'reel', 'vlog'],
  geopolitics: ['election', 'elections', 'war', 'defense', 'diplomacy', 'trade', 'policy', 'border', 'sanction', 'summit', 'military', 'china', 'russia', 'ukraine', 'israel', 'iran', 'india', 'us', 'global news', 'geopolitics'],
  travel: ['travel', 'trip', 'tourism', 'flight', 'visa', 'hotel', 'destination', 'itinerary', 'vacation', 'backpacking', 'beach', 'mountain', 'airport', 'train', 'resort', 'vlog'],
  food: ['food', 'recipe', 'cooking', 'cook', 'restaurant', 'street food', 'snack', 'meal', 'dinner', 'breakfast', 'lunch', 'chef', 'cafe', 'dish', 'pizza', 'burger', 'biryani', 'cake'],
  sports: ['sport', 'sports', 'football', 'soccer', 'cricket', 'fifa', 'world cup', 'ipl', 'f1', 'formula 1', 'tennis', 'match', 'league', 'nba', 'wwe', 'ufc', 'olympics', 'athlete', 'goal', 'race'],
  music: ['music', 'song', 'songs', 'spotify', 'album', 'artist', 'singer', 'concert', 'lyrics', 'remix', 'track', 'playlist', 'bollywood song', 'rap', 'pop', 'kpop'],
  'movies & entertainment': ['movie', 'movies', 'film', 'trailer', 'ott', 'netflix', 'series', 'show', 'actor', 'actress', 'box office', 'bollywood', 'hollywood', 'review', 'episode', 'celebrity', 'entertainment'],
  general: [],
}

function decodeEntities(text) {
  if (!text) return ''
  let decoded = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
  decoded = decoded.replace(/&([a-z0-9#]+);/gi, (match, name) => {
    const fullMatch = `&${name};`
    return ENTITY_MAP[fullMatch] || match
  })
  return decoded
}

function cleanTrendText(value) {
  if (!value) return ''
  let text = decodeEntities(String(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  // Strip parenthetical tracking codes like (ko5uYicV3W) or [ko5uYicV3W]
  text = text.replace(/[\(\[][a-zA-Z0-9]{8,15}[\)\]]/g, '')

  text = text.replace(/^[\s\-–—|:;,.!?"'()\[\]{}]+|[\s\-–—|:;,.!?"'()\[\]{}]+$/g, '')
  return text.trim()
}

function isReadableTrendText(value) {
  const text = cleanTrendText(value)
  if (text.length < 3 || text.length > 140) return false
  if (/[�]/.test(text)) return false
  const letters = text.match(/[A-Za-z0-9]/g)?.length || 0
  const nonLatinLetters = text.match(/[\u0370-\u1FFF\u2C00-\uD7FF\uF900-\uFFFF]/g)?.length || 0
  const totalLetters = letters + nonLatinLetters
  if (totalLetters > 0 && letters / totalLetters < 0.65) return false
  const noisy = text.match(/[^A-Za-z0-9\s.,:;!?&'"()\-–—/#@$%+]/g)?.length || 0
  return noisy / Math.max(text.length, 1) < 0.18
}

function isNicheRelevant(value, niche) {
  const normalizedNiche = normalizeNiche(niche)
  if (normalizedNiche === 'general') return true
  const text = cleanTrendText(value).toLowerCase()
  const terms = NICHE_TERMS[normalizedNiche] || []
  return terms.some(term => text.includes(term))
}

function sanitizeSignal(item, niche) {
  const title = cleanTrendText(item?.title || item?.query || item?.topic || item?.name || '')
  if (!isReadableTrendText(title)) return null
  if (!isNicheRelevant(title, niche)) return null
  return { ...item, title, query: item?.query ? cleanTrendText(item.query) : item?.query }
}

function dedupeSignals(items) {
  const seen = new Set()
  return items.filter(item => {
    const title = cleanTrendText(item?.title || item?.query || '')
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const TUTORIAL_KEYWORDS = [
  'tutorial', 'how to', 'guide', 'learn', 'step by step', 'for beginners', 'course', 'class',
  'walkthrough', 'explain', 'explainer', 'explained', 'tips', 'tricks', 'hack', 'hacks',
  'diy', 'lesson', 'lessons', 'teach', 'teaching'
];

const CHALLENGE_KEYWORDS = [
  'challenge', 'challenges', 'vs', 'experiment', 'test', 'attempt', 'trying', 'routine',
  'routines', 'workout routine', 'ppl', 'split', 'reset', 'day challenge', 'days challenge',
  'attempting', 'testing'
];

const TOOL_KEYWORDS = [
  'tool', 'tools', 'software', 'app', 'apps', 'gear', 'equipment', 'camera', 'lens', 'lenses',
  'preset', 'presets', 'lightroom', 'premiere', 'davinci', 'capcut', 'photoshop', 'plugin',
  'plugins', 'gadget', 'gadgets', 'setup', 'rig', 'microphones', 'mic'
];

const WORKFLOW_KEYWORDS = [
  'workflow', 'workflows', 'process', 'pipeline', 'method', 'methods', 'editing style',
  'editing workflow', 'routine', 'routines', 'automation', 'automations', 'automate',
  'system', 'systems', 'production'
];

const TECHNIQUE_KEYWORDS = [
  'technique', 'techniques', 'composition', 'cinematography', 'color grade', 'color grading',
  'lighting', 'b-roll', 'storytelling', 'nomad', 'framing', 'grading', 'grade', 'shot list'
];

const DISCUSSION_KEYWORDS = [
  'discussion', 'debate', 'trend', 'trends', 'hype', 'nomad trends', 'strategies', 'strategy',
  'growth', 'personal finance', 'talk', 'opinion', 'opinions', 'review', 'reviews', 'ideas',
  'idea', 'thoughts', 'podcast', 'interview'
];

const INDUSTRY_NEWS_KEYWORDS = [
  'launch', 'launches', 'announcement', 'announces', 'earnings', 'funding', 'startup',
  'startups', 'investment', 'investments', 'stock market', 'etf', 'tournament', 'tournaments',
  'match', 'matches', 'league', 'ipl', 'world cup', 'acquisition', 'acquired', 'merger',
  'raise', 'raised', 'funding round', 'new product'
];

const BREAKING_NEWS_KEYWORDS = [
  'murder', 'murders', 'killed', 'kill', 'killing', 'dead', 'death', 'arrest', 'arrested',
  'arrests', 'crime', 'crimes', 'court', 'case', 'cases', 'lawsuit', 'lawsuits', 'sue',
  'sued', 'sues', 'scandal', 'scandals', 'controversy', 'controversies', 'theft', 'thefts',
  'steal', 'stolen', 'robbery', 'robbed', 'incident', 'incidents', 'accident', 'accidents',
  'crash', 'crashed', 'police', 'shoot', 'shooting', 'shootings', 'stab', 'stabbed', 'assault',
  'assaulted', 'victim', 'suspect', 'guilty', 'jail', 'prison', 'disaster', 'disasters',
  'layoff', 'layoffs', 'drama'
];

const CREATOR_BOOSTS = {
  'fitness': [
    'workout routine', 'workout', 'training method', 'training', 'muscle building', 'muscle',
    'fat loss', 'weight loss', 'nutrition', 'protein', 'supplement', 'athlete training',
    'fitness challenge', 'challenge', 'recovery technique', 'recovery', 'diet', 'creatine',
    'exercise', 'health', 'gym guide', 'how to'
  ],
  'photography': [
    'editing style', 'editing', 'lightroom', 'photoshop', 'camera gear', 'camera', 'gear',
    'portrait photography', 'portrait', 'mobile photography', 'composition', 'visual trend',
    'photography challenge', 'preset', 'canon', 'sony', 'nikon', 'fujifilm', 'lens', 'lenses',
    'tutorial', 'shot list', 'how to'
  ],
  'filmmaking': [
    'cinematography', 'cinematic', 'storytelling', 'story', 'editing', 'edit', 'color grading',
    'color grade', 'camera technique', 'camera', 'production workflow', 'workflow', 'lighting',
    'b-roll', 'premiere', 'capcut', 'davinci', 'storyboard', 'talking head', 'tutorial', 'how to'
  ],
  'travel': [
    'destination', 'itinerary', 'travel hack', 'hack', 'digital nomad', 'nomad', 'tourism trend',
    'tourism', 'hidden location', 'hidden gem', 'travel planning', 'planning', 'guide', 'trip',
    'budget travel', 'backpacking', 'vlog', 'how to', 'hidden beach', 'hidden beaches', 'beach', 
    'beaches', 'trek', 'trekking', 'secret spot', 'secret viewpoint', 'unexplored', 'hidden waterfall', 
    'waterfalls', 'solo travel', 'adventure', 'explore', 'hidden beaches in goa', 'trek no one talks about',
    'secret hike', 'secret hikes', 'unexplored places', 'offbeat', 'goa', 'hike', 'hiking', 'overlooks',
    'viewpoint', 'viewpoints', 'hidden gems', 'backpacking guide', 'travel guide', 'road trip'
  ],
  'business & finance': [
    'investing', 'invest', 'startup', 'founder', 'funding', 'fund', 'entrepreneur',
    'saas', 'stock market', 'stock', 'crypto', 'bitcoin', 'ethereum', 'business growth',
    'growth', 'personal finance', 'budget', 'portfolio', 'sip', 'passive income', 'how to'
  ],
  'sports': [
    'tournament', 'match', 'player story', 'player', 'training', 'tactic', 'sports trend',
    'league', 'fifa', 'ipl', 'cup', 'champion', 'score', 'athletics', 'how to'
  ],
  'ai & technology': [
    'ai tool', 'ai', 'openai', 'chatgpt', 'claude', 'gemini', 'llm', 'product launch',
    'launch', 'software', 'automation', 'automate', 'startup', 'developer trend', 'developer',
    'coding', 'agent', 'github', 'productivity', 'how to'
  ],
  'default': ['tutorial', 'guide', 'challenge', 'tips', 'trick', 'hack', 'how to']
};

const CREATOR_DEPRIORITIZE = {
  'fitness': [
    'murder', 'killed', 'killing', 'dead', 'death', 'arrest', 'crime', 'court', 'case',
    'police', 'shoot', 'shot dead', 'stab', 'assault', 'victim', 'suspect', 'guilty', 'jail',
    'prison', 'incident', 'missing', 'disappears', 'tragedy', 'found dead', 'hospital', 'injured', 'injury', 'accident', 'crash'
  ],
  'photography': [
    'dispute', 'sue', 'lawsuit', 'accident', 'theft', 'steal', 'stolen', 'robbery', 'arrest',
    'gossip', 'scandal', 'court', 'divorce', 'legal'
  ],
  'filmmaking': [
    'scandal', 'gossip', 'divorce', 'arrest', 'rumor', 'affair', 'drama', 'sue', 'lawsuit',
    'controversy', 'molested', 'harassment', 'abuse', 'rape', 'assault', 'crime', 'murder', 'molest', 'molestation', 'harrased'
  ],
  'travel': [
    'accident', 'crash', 'dead', 'death', 'kill', 'killed', 'crime', 'murder', 'arrest',
    'stolen', 'robbed', 'theft', 'disaster', 'incident', 'police', 'hijack', 'stranded', 'delay',
    'delays', 'airport incident', 'airport chaos', 'visa rules', 'visa update', 'visa requirement',
    'visa requirements', 'cancelled flight', 'cancelled flights', 'flight delay', 'flight delays',
    'travel advisory', 'travel advisories', 'passport delay', 'passport backlog', 'embassy',
    'regulation', 'regulations', 'restrictions', 'border control', 'customs'
  ],
  'business & finance': [
    'lawsuit', 'sue', 'court', 'arrest', 'scam', 'fraud', 'theft', 'laundering', 'prison',
    'jail', 'guilty', 'corporate crime', 'legal case', 'bankruptcy', 'shut down'
  ],
  'sports': [
    'arrest', 'crime', 'charge', 'jail', 'police', 'court', 'controversy', 'scandal', 'ban',
    'banned', 'fine', 'fined', 'drugs', 'doping', 'cheat', 'suspended'
  ],
  'ai & technology': [
    'drama', 'sue', 'lawsuit', 'fight', 'fired', 'ousted', 'controversy', 'scandal', 'layoff',
    'layoffs', 'elon musk vs', 'sues'
  ],
  'gaming': [
    'fifa', 'sports', 'football', 'soccer', 'nba', 'cricket', 'basketball', 'wwe', 'ufc', 'tennis'
  ],
  'default': ['murder', 'accident', 'arrest', 'scandal', 'lawsuit', 'sue', 'court']
};

const GENERIC_CREATOR_BOOSTS = [
  'tutorial', 'guide', 'hacks', 'hack', 'tips', 'tip', 'tricks', 'trick', 'how to',
  'challenge', 'routine', 'workflow', 'setup', 'review', 'ideas', 'idea', 'methods',
  'method', 'strategy', 'strategies', 'techniques', 'technique', 'opportunity', 'creator'
];

const GENERIC_NEWS_DEPRIORITIZE = [
  'murder', 'kill', 'killed', 'dead', 'death', 'arrest', 'arrested', 'crime', 'court',
  'police', 'shoot', 'shooting', 'shot dead', 'stab', 'stabbed', 'assault', 'victim',
  'suspect', 'guilty', 'jail', 'prison', 'accident', 'crash', 'theft', 'steal', 'stolen',
  'robbery', 'robbed', 'scandal', 'lawsuit', 'sue', 'sued'
];

const TREND_TYPE_PRIORITIES = {
  'Tutorial': 1.5,
  'Challenge': 1.35,
  'Tool': 1.2,
  'Workflow': 1.1,
  'Technique': 1.05,
  'Discussion': 1.0,
  'Industry News': 0.8,
  'Breaking News': 0.4
};

function matchesAny(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
    return regex.test(lowerText);
  });
}

function countKeywordMatches(text, keywords) {
  let count = 0;
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
    if (regex.test(lowerText)) {
      count++;
    }
  }
  return count;
}

function classifyTrend(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  if (matchesAny(text, TUTORIAL_KEYWORDS)) return 'Tutorial';
  if (matchesAny(text, CHALLENGE_KEYWORDS)) return 'Challenge';
  if (matchesAny(text, TOOL_KEYWORDS)) return 'Tool';
  if (matchesAny(text, WORKFLOW_KEYWORDS)) return 'Workflow';
  if (matchesAny(text, TECHNIQUE_KEYWORDS)) return 'Technique';
  if (matchesAny(text, DISCUSSION_KEYWORDS)) return 'Discussion';
  if (matchesAny(text, INDUSTRY_NEWS_KEYWORDS)) return 'Industry News';
  return 'Breaking News';
}

function calculateCreatorRelevance(title, description, niche, scope = 'local') {
  const normalizedNiche = normalizeNiche(niche);
  const text = `${title} ${description || ''}`;

  let score = 50;

  if (scope === 'global') {
    const geoTerms = ['india', 'indian', 'indians', 'delhi', 'mumbai', 'bangalore', 'pune', 'chennai', 'kerala', 'goa', 'bollywood', 'bengaluru', 'hyderabad', 'kolkata', 'leh', 'ladakh', 'rupee', 'himalaya', 'himalayas', 'rajasthan'];
    const geoRegex = new RegExp(`\\b(${geoTerms.join('|')})\\b`, 'gi');
    if (geoRegex.test(text)) {
      return 0;
    }
  }

  const specificBoosts = CREATOR_BOOSTS[normalizedNiche] || [];
  const specificDeprioritize = CREATOR_DEPRIORITIZE[normalizedNiche] || [];

  score += countKeywordMatches(text, specificBoosts) * 15;
  score += countKeywordMatches(text, GENERIC_CREATOR_BOOSTS) * 10;
  
  score -= countKeywordMatches(text, specificDeprioritize) * 30;
  score -= countKeywordMatches(text, GENERIC_NEWS_DEPRIORITIZE) * 20;

  return Math.max(0, Math.min(100, score));
}

function calculateQualityScore(title, description, scope = 'local') {
  const cleanTitle = cleanTrendText(title || '');
  const cleanDesc = cleanTrendText(description || '');
  const text = `${cleanTitle} ${cleanDesc}`.toLowerCase();

  // 1. REJECTION CRITERIA (Instant Score = 0)
  
  // Coupon/Promo/Referral Code spam
  const promoRegex = /\b(use\s*code|promo\s*code|discount\s*code|coupon|referral|discount|affiliate|link\s*in\s*bio|link\s*in\s*description|buy\s*here)\b/i;
  if (promoRegex.test(text)) return 0;

  // Regional SEO / OTT Release Spam
  const regionalSeoRegex = /\b(hindi\s+dubbed|tamil\s+dubbed|telugu\s+dubbed|kannada\s+dubbed|malayalam\s+dubbed|dubbed|ott\s+release|release\s+date|latest\s+update|full\s+movie)\b/i;
  if (regionalSeoRegex.test(text)) return 0;

  // Playlist dumps
  const playlistRegex = /\b(playlist|lagu|terbaru|mixtape|song\s*collection|jukebox)\b/i;
  if (playlistRegex.test(text)) return 0;

  // Clickbait begging / personal phrases
  const clickbaitBeggingRegex = /\b(dontflop|blowup|makemefamous|viral\s*video|subscribe\s*now|click\s*here|follow\s*me|support\s*me|like\s*share|sub\s*to|pls\s*sub|plz\s*sub)\b/i;
  if (clickbaitBeggingRegex.test(text)) return 0;

  // Hinglish / regional slang particles (word boundaries)
  const regionalSlangRegex = /\b(yrr|yaar|bhai|bro\b|plz|pls|guys\b)/i;
  if (regionalSlangRegex.test(cleanTitle.toLowerCase())) return 0;

  // Hashtag counts
  const hashtagCount = (title.match(/#/g) || []).length + (description?.match(/#/g) || []).length;
  if (hashtagCount >= 3) return 0;

  // Emoji counts (consecutive or excessive)
  const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]/g;
  const emojiCount = (title.match(emojiRegex) || []).length + (description?.match(emojiRegex) || []).length;
  if (emojiCount >= 3) return 0;

  // SEO title stuffing: e.g. multiple pipes | or slashes / or commas ,
  const pipeCount = (title.match(/\|/g) || []).length;
  const commaCount = (title.match(/,/g) || []).length;
  const slashCount = (title.match(/\//g) || []).length;
  if (pipeCount >= 2 || commaCount >= 3 || slashCount >= 3) return 0;

  // 2. SCORING DEDUCTIONS

  let score = 100;

  // Shouting (all uppercase)
  const uppercaseLetters = cleanTitle.replace(/[^A-Z]/g, '').length;
  const lowercaseLetters = cleanTitle.replace(/[^a-z]/g, '').length;
  if (cleanTitle.length > 15 && uppercaseLetters > 0 && lowercaseLetters === 0) {
    score -= 30; // severe penalty for shouting
  }

  // Double punctuation clickbait (e.g. !! or ??)
  if (/!!|\?\?/g.test(cleanTitle)) {
    score -= 20;
  }

  // Clickbait phrases that aren't instant 0 but low quality
  const clickbaitPhrases = /\b(omg|shocking|unbelievable|you\s*won't\s*believe|revealed|secret\s*revealed|exposed)\b/i;
  if (clickbaitPhrases.test(text)) {
    score -= 25;
  }

  // Global Feed strictness penalty
  if (scope === 'global') {
    const regionalMarkers = /\b(hindi|tamil|telugu|kannada|malayalam|bhojpuri|punjabi|marathi|gujarati|bengali|urdu|arabic|indonesian|malay)\b/i;
    if (regionalMarkers.test(text)) {
      score = Math.min(score, 10); // cap score at 10 for regional content in global scope
    }
  }

  return Math.max(0, score);
}

function formatTitleByStyle(subject, niche, styleIndex) {
  const formattedSubject = subject.trim();

  const templates = {
    'fitness': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Optimization`, `${formattedSubject} Routines`, `${formattedSubject} Guidelines`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Is Gaining Traction`, `${formattedSubject} Content Is Surging`, `Demand For ${formattedSubject} Guides Is Rising`],
      // Style 2: Creator Opportunities
      [`Fitness Creators Focus On ${formattedSubject}`, `Fitness Creators Embrace ${formattedSubject}`, `Athletes Shift Toward ${formattedSubject}`],
      // Style 3: Emerging Trends
      [`The Shift Toward ${formattedSubject} Routines`, `The Rise Of ${formattedSubject} Content`, `The Evolution Of ${formattedSubject} Training`]
    ],
    'gaming': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Gameplay Trends`, `${formattedSubject} Strategies`, `${formattedSubject} Challenge Concepts`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Challenges Are Dominating Feeds`, `${formattedSubject} Content Is Gaining Traction`, `Interest In ${formattedSubject} Tactics Is Rising`],
      // Style 2: Creator Opportunities
      [`Gaming Channels Leverage ${formattedSubject}`, `Gaming Creators Are Adopting ${formattedSubject}`, `Gamers Shift Toward ${formattedSubject}`],
      // Style 3: Emerging Trends
      [`The Rise Of ${formattedSubject} Challenge Videos`, `The Shift To ${formattedSubject} Gameplay`, `The Evolution Of ${formattedSubject} Speedruns`]
    ],
    'music': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Trends`, `${formattedSubject} Playlists`, `${formattedSubject} Production`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Audio Is Gaining Traction`, `${formattedSubject} Charts Are Surging`, `${formattedSubject} Is Reshaping Stream Lists`],
      // Style 2: Creator Opportunities
      [`Music Creators Leverage ${formattedSubject}`, `Artists Are Embracing ${formattedSubject} Styles`, `Producers Shift Toward ${formattedSubject}`],
      // Style 3: Emerging Trends
      [`The Return Of ${formattedSubject} Content`, `The Rise Of ${formattedSubject} On Streaming`, `The Shift To ${formattedSubject} Audios`]
    ],
    'movies & entertainment': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Breakdown Content`, `${formattedSubject} Discussions`, `${formattedSubject} Analyses`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Reviews Are Surging`, `${formattedSubject} Topics Are Gaining Traction`, `Commentary On ${formattedSubject} Is Rising`],
      // Style 2: Creator Opportunities
      [`Entertainment Creators Focus On ${formattedSubject}`, `Movie Channels Shift Toward ${formattedSubject}`, `Creators Leverage ${formattedSubject} Discussions`],
      // Style 3: Emerging Trends
      [`The Rise Of ${formattedSubject} Commentary`, `The Shift To ${formattedSubject} Breakdowns`, `The Evolution Of ${formattedSubject} Media`]
    ],
    'filmmaking': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Techniques`, `${formattedSubject} Workflows`, `${formattedSubject} Styles`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Tools Are Reshaping Production`, `${formattedSubject} Techniques Are Gaining Traction`, `Demand For ${formattedSubject} Tutorials Is Surging`],
      // Style 2: Creator Opportunities
      [`Filmmakers Are Adopting ${formattedSubject}`, `Video Editors Focus On ${formattedSubject}`, `Creators Shift Toward ${formattedSubject} Workflows`],
      // Style 3: Emerging Trends
      [`The Shift To ${formattedSubject} Workflows`, `The Rise Of ${formattedSubject} Techniques`, `The Return Of Traditional ${formattedSubject}`]
    ],
    'photography': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Composition Styles`, `${formattedSubject} Gear & Settings`, `${formattedSubject} Setups`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Trends Are Surging`, `${formattedSubject} Styles Are Gaining Traction`, `Interest In ${formattedSubject} Gear Is Rising`],
      // Style 2: Creator Opportunities
      [`Photographers Shift Toward ${formattedSubject}`, `Visual Artists Are Adopting ${formattedSubject}`, `Creators Focus On ${formattedSubject} Techniques`],
      // Style 3: Emerging Trends
      [`The Rise Of ${formattedSubject} Styles`, `The Return Of ${formattedSubject} Gear`, `The Evolution Of ${formattedSubject} Composition`]
    ],
    'travel': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Destinations`, `${formattedSubject} Itinerary Planning`, `${formattedSubject} Travel`],
      // Style 1: Trend Headlines
      [`Interest In ${formattedSubject} Is Surging`, `${formattedSubject} Destinations Are Gaining Traction`, `Demand For ${formattedSubject} Guides Is Rising`],
      // Style 2: Creator Opportunities
      [`Travel Creators Shift Toward ${formattedSubject}`, `Vloggers Focus On ${formattedSubject}`, `Travel Channels Leverage ${formattedSubject} Guides`],
      // Style 3: Emerging Trends
      [`The Rise Of ${formattedSubject} Destinations`, `The Shift Toward ${formattedSubject} Experiences`, `The Evolution Of ${formattedSubject} Vlogs`]
    ],
    'business & finance': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Strategies`, `${formattedSubject} Investing`, `${formattedSubject} Growth`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Content Is Surging`, `${formattedSubject} Trends Are Reshaping Markets`, `Interest In ${formattedSubject} Is Gaining Traction`],
      // Style 2: Creator Opportunities
      [`Finance Creators Focus On ${formattedSubject}`, `Founders Shift Toward ${formattedSubject}`, `Investors Leverage ${formattedSubject} Tactics`],
      // Style 3: Emerging Trends
      [`The Rise Of ${formattedSubject} Platforms`, `The Shift Toward ${formattedSubject} Strategies`, `The Evolution Of ${formattedSubject} Markets`]
    ],
    'ai & technology': [
      // Style 0: Trend Concepts
      [`${formattedSubject} Workflows`, `${formattedSubject} Systems`, `${formattedSubject} Development`],
      // Style 1: Trend Headlines
      [`${formattedSubject} Is Reshaping Development`, `${formattedSubject} Tools Are Surging`, `${formattedSubject} Workflows Are Gaining Traction`],
      // Style 2: Creator Opportunities
      [`Developers Are Adopting ${formattedSubject}`, `Tech Creators Focus On ${formattedSubject}`, `Teams Shift Toward ${formattedSubject}`],
      // Style 3: Emerging Trends
      [`The Rise Of ${formattedSubject} Automation`, `The Shift To ${formattedSubject} Tools`, `The Evolution Of ${formattedSubject} Tech`]
    ]
  };

  const nicheTemplates = templates[niche] || [
    [`${formattedSubject} Concepts`, `${formattedSubject} Content`],
    [`${formattedSubject} Is Gaining Traction`, `${formattedSubject} Is Surging`],
    [`Creators Shift Toward ${formattedSubject}`, `Content Channels Leverage ${formattedSubject}`],
    [`The Rise Of ${formattedSubject}`, `The Shift Toward ${formattedSubject}`]
  ];

  const categoryTemplates = nicheTemplates[styleIndex] || nicheTemplates[0];
  const templateIndex = formattedSubject.length % categoryTemplates.length;
  let finalTitle = categoryTemplates[templateIndex];

  // Clean up redundant word combinations from template insertions
  finalTitle = finalTitle
    .replace(/\bStreaming On Streaming\b/gi, 'Streaming')
    .replace(/\bChallenge Challenge\b/gi, 'Challenge')
    .replace(/\bPlaylists? Playlists?\b/gi, 'Playlists')
    .replace(/\bWorkflows? Workflows?\b/gi, 'Workflows')
    .replace(/\bTechniques? Techniques?\b/gi, 'Techniques')
    .replace(/\bDestinations? Destinations?\b/gi, 'Destinations')
    .replace(/\bContent Content\b/gi, 'Content')
    .replace(/\bTrends? Trends?\b/gi, 'Trends')
    .replace(/\bGuides? Guides?\b/gi, 'Guides')
    .replace(/\bTutorials? Tutorials?\b/gi, 'Tutorials');

  return finalTitle;
}

function abstractTrendTopic(title, niche = 'general') {
  const cleanTitle = cleanTrendText(title || '');
  const lowerTitle = cleanTitle.toLowerCase();
  const normalizedNiche = normalizeNiche(niche);

  // 1. Compute stable hash for style selection
  let hash = 0;
  for (let i = 0; i < cleanTitle.length; i++) {
    hash = (hash * 31 + cleanTitle.charCodeAt(i)) & 0xFFFFFFFF;
  }
  const styleIndex = Math.abs(hash) % 4;

  let subject = '';

  // --- 2. EXTRACT CORE SUBJECT (Rule-Based) ---

  // Challenge Pattern (e.g. 100 Days Hardcore Minecraft Challenge)
  const challengeDayRegex = /(\d+)\s*days?\b/i;
  if (challengeDayRegex.test(lowerTitle) && lowerTitle.includes('challenge')) {
    const days = lowerTitle.match(challengeDayRegex)[1];
    const games = ['minecraft', 'roblox', 'fortnite', 'gta', 'bgmi', 'pubg', 'valorant'];
    let gameName = '';
    for (const game of games) {
      if (lowerTitle.includes(game)) {
        gameName = game.charAt(0).toUpperCase() + game.slice(1) + ' ';
        break;
      }
    }
    subject = `${days}-Day ${gameName}Challenge`;
  }
  // Protein Absorption Rule
  else if (lowerTitle.includes('protein') && (lowerTitle.includes('absorption') || lowerTitle.includes('absorb') || lowerTitle.includes('intake') || lowerTitle.includes('synthesis'))) {
    subject = 'Protein Optimization';
  }
  // Spotify / Streaming Songs Rule
  else if (lowerTitle.includes('spotify') || lowerTitle.includes('streamed') || lowerTitle.includes('streams') || lowerTitle.includes('songs')) {
    if (lowerTitle.includes('streamed') || lowerTitle.includes('most') || lowerTitle.includes('chart') || lowerTitle.includes('top')) {
      subject = 'Global Streaming';
    } else {
      subject = 'Music Streaming';
    }
  }
  // Trailer Breakdown Rule
  else if (lowerTitle.includes('trailer') && (lowerTitle.includes('breakdown') || lowerTitle.includes('reaction') || lowerTitle.includes('review'))) {
    subject = 'Trailer Breakdown';
  }
  // Color Grading Rule
  else if ((lowerTitle.includes('color') || lowerTitle.includes('colour')) && (lowerTitle.includes('grade') || lowerTitle.includes('grading')) || lowerTitle.includes('davinci') || lowerTitle.includes('resolve')) {
    if (lowerTitle.includes('grade') || lowerTitle.includes('grading') || lowerTitle.includes('tutorial') || lowerTitle.includes('davinci')) {
      subject = 'Color Grading';
    }
  }

  // --- 3. NICHE-SPECIFIC KEYWORD REGEX RULE-SET ---
  if (!subject) {
    if (normalizedNiche === 'fitness') {
      if (lowerTitle.includes('workout') || lowerTitle.includes('exercise') || lowerTitle.includes('routine')) {
        subject = 'Workout Routine';
      } else if (lowerTitle.includes('diet') || lowerTitle.includes('nutrition') || lowerTitle.includes('meal')) {
        subject = 'Dietary Nutrition';
      } else if (lowerTitle.includes('muscle') || lowerTitle.includes('hypertrophy') || lowerTitle.includes('gain')) {
        subject = 'Muscle Hypertrophy';
      } else if (lowerTitle.includes('fat') || lowerTitle.includes('weight') || lowerTitle.includes('loss') || lowerTitle.includes('shred')) {
        subject = 'Weight Loss';
      }
    }

    else if (normalizedNiche === 'gaming') {
      if (lowerTitle.includes('minecraft')) {
        subject = 'Minecraft Gameplay';
      } else if (lowerTitle.includes('valorant') || lowerTitle.includes('bgmi') || lowerTitle.includes('pubg') || lowerTitle.includes('fortnite')) {
        subject = 'Competitive Gaming';
      } else if (lowerTitle.includes('update') || lowerTitle.includes('patch') || lowerTitle.includes('season')) {
        subject = 'Game Update';
      }
    }

    else if (normalizedNiche === 'ai & technology') {
      if (lowerTitle.includes('chatgpt') || lowerTitle.includes('openai') || lowerTitle.includes('claude') || lowerTitle.includes('gemini') || lowerTitle.includes('ai tool')) {
        subject = 'AI Tool';
      } else if (lowerTitle.includes('iphone') || lowerTitle.includes('samsung') || lowerTitle.includes('pixel') || lowerTitle.includes('phone') || lowerTitle.includes('macbook')) {
        subject = 'Consumer Tech';
      } else if (lowerTitle.includes('code') || lowerTitle.includes('coding') || lowerTitle.includes('developer') || lowerTitle.includes('github') || lowerTitle.includes('programming')) {
        subject = 'AI Coding Tools';
      } else if (lowerTitle.includes('automation') || lowerTitle.includes('automate')) {
        subject = 'AI Automation';
      }
    }

    else if (normalizedNiche === 'filmmaking') {
      if (lowerTitle.includes('cinematic') || lowerTitle.includes('cinematography') || lowerTitle.includes('b-roll') || lowerTitle.includes('lighting')) {
        subject = 'Cinematic B-Roll';
      } else if (lowerTitle.includes('edit') || lowerTitle.includes('editing') || lowerTitle.includes('capcut') || lowerTitle.includes('premiere') || lowerTitle.includes('after effects')) {
        subject = 'Video Editing';
      }
    }

    else if (normalizedNiche === 'photography') {
      if (lowerTitle.includes('camera') || lowerTitle.includes('lens') || lowerTitle.includes('gear') || lowerTitle.includes('canon') || lowerTitle.includes('sony') || lowerTitle.includes('nikon') || lowerTitle.includes('fujifilm')) {
        subject = 'Camera Gear';
      } else if (lowerTitle.includes('portrait') || lowerTitle.includes('street') || lowerTitle.includes('landscape') || lowerTitle.includes('composition')) {
        subject = 'Photography Composition';
      } else if (lowerTitle.includes('editing') || lowerTitle.includes('lightroom') || lowerTitle.includes('preset') || lowerTitle.includes('photoshop')) {
        subject = 'Photo Post-Processing';
      }
    }

    else if (normalizedNiche === 'travel') {
      if (lowerTitle.includes('itinerary') || lowerTitle.includes('budget') || lowerTitle.includes('planning')) {
        subject = 'Travel Itinerary';
      } else if (lowerTitle.includes('hidden') || lowerTitle.includes('secret') || lowerTitle.includes('unexplored') || lowerTitle.includes('offbeat') || lowerTitle.includes('gems')) {
        subject = 'Hidden Destinations';
      }
    }

    else if (normalizedNiche === 'business & finance') {
      if (lowerTitle.includes('investing') || lowerTitle.includes('invest') || lowerTitle.includes('stock') || lowerTitle.includes('shares') || lowerTitle.includes('sip') || lowerTitle.includes('mutual')) {
        subject = 'Investment';
      } else if (lowerTitle.includes('startup') || lowerTitle.includes('founder') || lowerTitle.includes('funding') || lowerTitle.includes('business')) {
        subject = 'Startup Growth';
      } else if (lowerTitle.includes('crypto') || lowerTitle.includes('bitcoin') || lowerTitle.includes('ethereum')) {
        subject = 'Cryptocurrency';
      }
    }

    else if (normalizedNiche === 'movies & entertainment') {
      if (lowerTitle.includes('review') || lowerTitle.includes('reaction') || lowerTitle.includes('verdict')) {
        subject = 'Movie Reaction';
      } else if (lowerTitle.includes('ott') || lowerTitle.includes('netflix') || lowerTitle.includes('prime') || lowerTitle.includes('disney')) {
        subject = 'OTT Release';
      }
    }
  }

  // --- 4. GENERIC FALLBACK SUBJECT EXTRACTION ---
  if (!subject) {
    const noiseWords = new Set([
      'how', 'to', 'i', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'it', 
      'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 
      'do', 'does', 'did', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'with', 'about', 
      'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 
      'below', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 
      'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'all', 'any', 
      'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 
      'don', 'should', 'now', 'this', 'that', 'these', 'those', 'at', 'by', 'of', 'on', 
      'with', 'vs', 'versus', 'tutorial', 'guide', 'challenge', 'tips', 'tricks', 'hack', 
      'hacks', 'show', 'video', 'watch', 'learn', 'make', 'do', 'get', 'best', 'new'
    ]);

    const words = cleanTitle.split(/\s+/);
    const keyTerms = words.filter(word => {
      const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanWord.length > 0 && !noiseWords.has(cleanWord);
    });

    if (keyTerms.length > 0) {
      subject = keyTerms.slice(0, 3).map(word => {
        const clean = word.replace(/[^a-zA-Z0-9]/g, '');
        if (clean.length === 0) return '';
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      }).filter(Boolean).join(' ');
    }
  }

  if (!subject || subject.length < 2) {
    const prettyNiche = normalizedNiche.split('&').map(w => w.trim().charAt(0).toUpperCase() + w.trim().slice(1)).join(' & ');
    subject = `${prettyNiche} Opportunities`;
  }

  // Clean trailing suffix keywords from subject to avoid redundant titles
  const keywordsToStrip = /\s+(content|techniques?|workflows?|strategies?|concepts?|trends?|challenges?|guides?|tutorials?|systems?|tactics?|tools?)$/i;
  const cleanSubject = subject.replace(keywordsToStrip, '').trim();

  return formatTitleByStyle(cleanSubject, normalizedNiche, styleIndex);
}

module.exports = {
  NICHE_TERMS,
  cleanTrendText,
  isReadableTrendText,
  isNicheRelevant,
  sanitizeSignal,
  dedupeSignals,
  classifyTrend,
  calculateCreatorRelevance,
  TREND_TYPE_PRIORITIES,
  calculateQualityScore,
  abstractTrendTopic,
}