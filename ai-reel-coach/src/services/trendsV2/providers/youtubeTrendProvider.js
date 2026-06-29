const axios = require('axios')
const { sanitizeSignal, dedupeSignals } = require('../trendSanitizer')

const { regionConfig } = require('../regions')
const getRegionCode = (region) => regionConfig(region).yt

const EVENT_QUERIES = {
  'ai & technology':        'AI launch OR new tech tool OR keynote OR software update OR model release',
  gaming:                   'game launch OR trailer OR esports tournament OR patch notes OR streamer event',
  'business & finance':     'startup funding OR IPO OR funding announcement OR business launch OR market crash',
  fitness:                  'supplement launch OR fitness event OR athlete announcement OR fitness competition',
  photography:              'camera launch OR new lens OR photography award OR editing software update',
  filmmaking:               'gear launch OR film festival OR new cinema camera OR editing software update',
  geopolitics:              'election results OR diplomatic summit OR defense announcement OR major conflict',
  travel:                   'tourism announcement OR visa update OR travel festival OR new airline route',
  food:                     'restaurant launch OR new menu OR food festival OR fast food release',
  sports:                   'match highlights OR retirement OR player transfer OR tournament OR championship',
  music:                    'album release OR concert tour OR music festival OR artist announcement',
  'movies & entertainment': 'movie trailer OR box office OR OTT release OR casting announcement OR award show',
  general:                  'breaking news OR major event OR world news',
}

const CREATOR_QUERIES = {
  'ai & technology':        'viral AI workflow OR new AI tool OR AI update OR productivity trend',
  gaming:                   'gaming trend OR viral gameplay OR new meta OR speedrun record',
  'business & finance':     'startup trend OR business trend OR side hustle trend OR passive income trend',
  fitness:                  'workout routine trend OR viral workout OR new workout challenge OR fitness trend',
  photography:              'viral photography trend OR new Lightroom feature OR creator challenge OR shooting trend',
  filmmaking:               'viral editing trend OR new editing workflow OR cinematic trend OR creator tool trend',
  geopolitics:              'geopolitics analysis OR world news explained OR political trend',
  travel:                   'viral travel destination OR travel trend OR budget travel trend OR packing hack trend',
  food:                     'viral recipe OR viral dish OR new cooking trend OR food challenge',
  sports:                   'sports tactics trend OR sports analysis OR viral training drill OR athlete workout trend',
  music:                    'viral song OR trending audio OR music production trend OR tiktok music trend',
  'movies & entertainment': 'viral movie review OR fan theory trend OR behind the scenes trend OR creator reaction',
  general:                  'viral trend OR trending challenge OR social media trend',
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

  // Global Mode Aggregation across major macro-regions
  if (region === 'Global') {
    const regions = ['US', 'BR', 'UK', 'UAE', 'India', 'Japan', 'Nigeria', 'Australia']
    const results = await Promise.all(regions.map(r => fetchTrends(r, niche).catch(() => [])))
    return dedupeSignals(results.flat())
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 15)
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

    const eventQ = EVENT_QUERIES[niche] || EVENT_QUERIES.general
    const creatorQ = CREATOR_QUERIES[niche] || CREATOR_QUERIES.general
    const publishedAfter = new Date(Date.now() - 3 * 86400000).toISOString() // 72 hours max freshness
    
    const fetchStream = async (q) => {
      const resp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key, part: 'snippet', q, type: 'video',
          order: 'viewCount', maxResults: 15, // Get top 15 from each stream
          publishedAfter, regionCode, relevanceLanguage: regionConfig(region).lang, safeSearch: 'none',
        },
        timeout: 8000,
      })
      return resp.data.items || []
    }

    const [eventItems, creatorItems] = await Promise.all([
      fetchStream(eventQ).catch(() => []),
      fetchStream(creatorQ).catch(() => [])
    ])

    const searchItems = [...eventItems, ...creatorItems]
    
    // De-duplicate raw YouTube API items by videoId before fetching stats
    const uniqueItemsMap = new Map()
    for (const it of searchItems) {
      if (it.id?.videoId && !uniqueItemsMap.has(it.id.videoId)) {
        uniqueItemsMap.set(it.id.videoId, it)
      }
    }
    const uniqueSearchItems = Array.from(uniqueItemsMap.values())

    const ids = uniqueSearchItems.map(it => it.id?.videoId).filter(Boolean)
    const stats = await fetchVideoStats(key, ids).catch(() => new Map())

    const signals = uniqueSearchItems.map(it => {
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
      .slice(0, 20)
  } catch (err) {
    console.warn('[YouTube] signal fetch error:', err.response?.data?.error?.message || err.message)
    return []
  }
}

module.exports = { fetchTrends }