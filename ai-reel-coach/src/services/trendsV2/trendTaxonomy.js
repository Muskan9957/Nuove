const NICHE_ALIASES = {
  all: 'general',
  general: 'general',
  ai: 'ai & technology',
  tech: 'ai & technology',
  technology: 'ai & technology',
  'ai technology': 'ai & technology',
  'ai & technology': 'ai & technology',
  movies: 'movies & entertainment',
  entertainment: 'movies & entertainment',
  'movies entertainment': 'movies & entertainment',
  'movies & entertainment': 'movies & entertainment',
  finance: 'business & finance',
  'business & startups': 'business & finance',
  'business startups': 'business & finance',
  business: 'business & finance',
  startups: 'business & finance',
  'business & finance': 'business & finance',
}

const VALID_NICHES = [
  'general',
  'ai & technology',
  'gaming',
  'business & finance',
  'fitness',
  'photography',
  'filmmaking',
  'geopolitics',
  'travel',
  'food',
  'sports',
  'music',
  'movies & entertainment',
]

const REGION_ALIASES = {
  india: 'India',
  in: 'India',
  global: 'Global',
  worldwide: 'Global',
  world: 'Global',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  uk: 'UK',
  'united kingdom': 'UK',
  'middle east': 'Middle East',
  'southeast asia': 'Southeast Asia',
}

function keyify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
}

function normalizeNiche(value) {
  const key = keyify(value)
  const normalized = NICHE_ALIASES[key] || key
  return VALID_NICHES.includes(normalized) ? normalized : 'general'
}

function normalizeRegion(value) {
  const key = keyify(value)
  if (!key) return 'India'
  return REGION_ALIASES[key] || String(value).trim()
}

function normalizeScope(value, region) {
  const key = keyify(value)
  if (key === 'global' || normalizeRegion(region) === 'Global') return 'global'
  return 'local'
}

function cacheKeyParts({ niche, language, region, scope, date }) {
  return {
    niche: normalizeNiche(niche),
    language: keyify(language) || 'en',
    region: normalizeRegion(region),
    scope: normalizeScope(scope, region),
    date,
  }
}

module.exports = {
  VALID_NICHES,
  normalizeNiche,
  normalizeRegion,
  normalizeScope,
  cacheKeyParts,
}
