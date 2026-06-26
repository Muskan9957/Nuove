const axios = require('axios')
const { sanitizeSignal, dedupeSignals } = require('../trendSanitizer')

const { regionConfig } = require('../regions')
const getRegionCode = (region) => regionConfig(region).yt

const NICHE_SEARCH = {
  'ai & technology':        'OpenAI OR Claude OR Gemini AI tools',
  gaming:                  'gaming esports viral',
  'business & finance':     'investing "stock market" startups entrepreneurship funding SaaS "personal finance" crypto "business growth" "market trends"',
  fitness:                 'fitness workout gym protein',
  photography:             'photography camera lightroom portrait',
  filmmaking:              'filmmaking cinematography video editing',
  geopolitics:             'geopolitics elections defense diplomacy',
  travel:                  '"hidden beaches" OR "trek no one talks about" OR "hidden gems" OR "secret hikes" OR "travel itinerary" OR "backpacking guide" OR "budget travel" OR "travel hacks" OR offbeat',
  food:                    'food recipe cooking street food',
  sports:                  'football cricket FIFA F1 tennis',
  music:                   'viral song music Spotify',
  'movies & entertainment':'movie trailer OTT box office series',
  general:                 'trending viral today',
}

async function fetchVideoStats(key, ids) {
  if (!ids.length) return new Map()
  const resp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: { key, part: 'statistics,snippet', id: ids.join(',') },
    timeout: 8000,
  })

  return new Map((resp.data.items || []).map(item => [item.id, {
    viewCount: parseInt(item.statistics?.viewCount || '0', 10),
    likeCount: parseInt(item.statistics?.likeCount || '0', 10),
    title: item.snippet?.title,
    channelTitle: item.snippet?.channelTitle,
    publishedAt: item.snippet?.publishedAt,
  }]))
}

async function fetchTrends(region = 'India', niche = 'general') {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return []

  // "Global" = worldwide blend, deliberately EXCLUDING India (and other
  // South-Asian-heavy regions) so it stays distinct from the Local (India) tab.
  if (region === 'Global') {
    const regions = ['US', 'UK']
    const results = await Promise.all(regions.map(r => fetchTrends(r, niche).catch(() => [])))
    return dedupeSignals(results.flat())
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 10)
  }

  const regionCode = getRegionCode(region)
  const isGeneral = !niche || niche === 'general'

  try {
    if (isGeneral) {
      const resp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: { key, part: 'snippet,statistics', chart: 'mostPopular', regionCode, maxResults: 20 },
        timeout: 8000,
      })
      return dedupeSignals((resp.data.items || [])
        .map(it => sanitizeSignal({
          title: it.snippet?.title,
          viewCount: parseInt(it.statistics?.viewCount || '0', 10),
          channelTitle: it.snippet?.channelTitle,
          publishedAt: it.snippet?.publishedAt,
        }, niche))
        .filter(Boolean)
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)))
        .slice(0, 10)
    }

    const q = NICHE_SEARCH[niche] || niche
    const publishedAfter = new Date(Date.now() - 14 * 86400000).toISOString()
    const resp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key, part: 'snippet', q, type: 'video',
        order: 'viewCount', maxResults: 20,
        publishedAfter, regionCode, relevanceLanguage: regionConfig(region).lang, safeSearch: 'none',
      },
      timeout: 8000,
    })

    const searchItems = resp.data.items || []
    const ids = searchItems.map(it => it.id?.videoId).filter(Boolean)
    const stats = await fetchVideoStats(key, ids).catch(() => new Map())

    const signals = searchItems.map(it => {
      const id = it.id?.videoId
      const detail = stats.get(id) || {}
      return sanitizeSignal({
        title: detail.title || it.snippet?.title,
        viewCount: detail.viewCount || 0,
        likeCount: detail.likeCount || 0,
        channelTitle: detail.channelTitle || it.snippet?.channelTitle,
        publishedAt: detail.publishedAt || it.snippet?.publishedAt,
      }, niche)
    }).filter(Boolean)

    return dedupeSignals(signals)
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 10)
  } catch (err) {
    console.warn('[YouTube] signal fetch error:', err.response?.data?.error?.message || err.message)
    return []
  }
}

module.exports = { fetchTrends }