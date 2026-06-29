const axios = require('axios')
const { cleanTrendText, sanitizeSignal, dedupeSignals } = require('../trendSanitizer')
const { regionConfig } = require('../regions')

const getGeo = (region) => regionConfig(region).yt

const EVENT_TOPICS = {
  'ai & technology':        'topic/TECHNOLOGY',
  gaming:                   'topic/TECHNOLOGY', // Closest match, combined with creator queries
  'business & finance':     'topic/BUSINESS',
  fitness:                  'topic/HEALTH',
  photography:              'topic/ENTERTAINMENT', // Fallback
  filmmaking:               'topic/ENTERTAINMENT',
  geopolitics:              'topic/WORLD',
  travel:                   'topic/NATION', // Fallback
  food:                     'topic/HEALTH', // Fallback
  sports:                   'topic/SPORTS',
  music:                    'topic/ENTERTAINMENT',
  'movies & entertainment': 'topic/ENTERTAINMENT',
  general:                  'topic/WORLD',
}

const CREATOR_QUERIES = {
  'ai & technology':        ['viral AI workflow', 'new AI tool', 'AI update', 'productivity trend'],
  gaming:                   ['gaming trend', 'viral gameplay', 'speedrun record'],
  'business & finance':     ['startup trend', 'business trend', 'side hustle trend'],
  fitness:                  ['workout routine trend', 'viral workout', 'fitness challenge 2026', 'fitness trend'],
  photography:              ['viral photography trend', 'new Lightroom feature', 'creator challenge', 'shooting trend'],
  filmmaking:               ['viral editing trend', 'new editing workflow', 'cinematic trend', 'creator tool trend'],
  geopolitics:              ['geopolitics analysis', 'political trend'],
  travel:                   ['viral travel destination', 'travel trend', 'festival', 'visa announcement'],
  food:                     ['viral recipe', 'viral dish', 'new cooking trend', 'food challenge'],
  sports:                   ['sports tactics trend', 'viral training drill', 'athlete workout trend'],
  music:                    ['viral song', 'trending audio', 'tiktok music trend'],
  'movies & entertainment': ['viral movie review', 'fan theory trend', 'behind the scenes trend'],
  general:                  ['viral trend', 'trending challenge', 'social media trend'],
}

function decodeXml(value = '') {
  return cleanTrendText(String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'))
}

function stripPublisherSuffix(title) {
  if (!title) return ''
  let cleaned = title.replace(/\s+[-\|–—]\s+[A-Za-z0-9\.\s&]{2,40}$/gi, '')
  cleaned = cleaned.replace(/\s+-\s+[^-]{2,60}(\.com|\.org|\.net|News|BBC|Reuters|Bloomberg|Forbes|ESPN|NDTV|Hindu|Times|World|Fstoppers|Photographer|olympics\.com|Mshale)$/i, '')
  return cleanTrendText(cleaned)
}

function parseRssItems(xml, sourceType) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml))) {
    const block = match[1]
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
    let description = decodeXml(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '')

    if (sourceType === 'google-trends-rss') {
      const newsItemTitle = decodeXml(block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] || '')
      const newsItemSnippet = decodeXml(block.match(/<ht:news_item_snippet>([\s\S]*?)<\/ht:news_item_snippet>/)?.[1] || '')
      if (newsItemTitle) {
        description = newsItemSnippet ? `${newsItemTitle} - ${newsItemSnippet}` : newsItemTitle
      }
    }

    const pubDate = decodeXml(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '')
    const trafficRaw = decodeXml(block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] || '')
    const traffic = parseInt(trafficRaw.replace(/[^0-9]/g, '') || '0', 10)
    if (title) items.push({ title, query: title, description, publishedAt: pubDate, value: traffic, sourceType })
  }
  return items
}

async function fetchRss(url) {
  const resp = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 NuoveTrendBot/1.0' },
  })
  return parseRssItems(resp.data || '', url.includes('trending/rss') ? 'google-trends-rss' : 'google-news-rss')
}

function newsUrl(query, locale) {
  const q = `${query} when:3d` // 72 hours max freshness
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`
}

function newsTopicUrl(topicPath, locale) {
  return `https://news.google.com/news/rss/headlines/section/${topicPath}?hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`
}

async function fetchTrends(region, niche) {
  // Global Mode Aggregation across major macro-regions
  if (region === 'Global') {
    const regions = ['US', 'BR', 'UK', 'UAE', 'India', 'Japan', 'Nigeria', 'Australia']
    const results = await Promise.all(regions.map(r => fetchTrends(r, niche).catch(() => [])))
    return dedupeSignals(results.flat())
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 15)
  }

  const geo = getGeo(region)
  const newsLocale = regionConfig(region).news
  const eventTopic = EVENT_TOPICS[niche] || EVENT_TOPICS.general
  const creatorQueries = CREATOR_QUERIES[niche] || CREATOR_QUERIES.general
  
  const urls = [
    `https://trends.google.com/trending/rss?geo=${geo}`,
    newsTopicUrl(eventTopic, newsLocale),
    ...creatorQueries.slice(0, 3).map(query => newsUrl(query, newsLocale)),
    // Focus specifically on creator platforms like Instagram/TikTok for this niche
    newsUrl(`(${creatorQueries.join(' OR ')}) AND (Instagram OR TikTok OR YouTube OR viral)`, newsLocale)
  ]

  try {
    const results = await Promise.allSettled(urls.map(fetchRss))
    const merged = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .map((item, index) => {
        const strippedTitle = stripPublisherSuffix(item.title)
        return {
          ...item,
          title: strippedTitle,
          query: strippedTitle,
          sourceScore: (item.value || 0) + Math.max(100 - index, 0),
          growth: item.sourceType === 'google-trends-rss' ? 'rising' : 'current',
        }
      })

    const clean = dedupeSignals(
      merged
        .map(item => sanitizeSignal(item, niche))
        .filter(Boolean)
        .sort((a, b) => (b.sourceScore || 0) - (a.sourceScore || 0))
    )

    return clean.slice(0, 10).map(item => ({
      query: item.query || item.title,
      title: item.title,
      description: item.description,
      value: item.value,
      growth: item.growth,
      sourceType: item.sourceType,
      publishedAt: item.publishedAt,
    }))
  } catch (err) {
    console.warn('[GoogleTrends] RSS unavailable:', err.message)
    return []
  }
}

module.exports = { fetchTrends }