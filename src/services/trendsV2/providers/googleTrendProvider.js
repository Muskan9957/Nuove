const axios = require('axios')
const { cleanTrendText, sanitizeSignal, dedupeSignals } = require('../trendSanitizer')

const GEO_CODE = {
  India: 'IN', US: 'US', UK: 'GB',
  'Middle East': 'AE', 'Southeast Asia': 'ID', Global: 'US',
}
const getGeo = (region) => GEO_CODE[region] ?? 'IN'

const NEWS_LOCALE = {
  IN: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  US: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  GB: { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  AE: { hl: 'en-AE', gl: 'AE', ceid: 'AE:en' },
  ID: { hl: 'en-ID', gl: 'ID', ceid: 'ID:en' },
}

const NICHE_QUERIES = {
  'ai & technology': ['OpenAI OR Claude OR Gemini OR AI tools', 'artificial intelligence technology'],
  gaming: ['"esports" OR "pc gaming" OR streamer OR twitch OR valorant OR csgo OR bgmi', '"gaming industry" OR "gaming setup" OR gameplay'],
  'business & finance': ['investing OR startups OR "stock market" OR "venture capital" OR SaaS', 'funding OR "personal finance" OR crypto OR "business growth" OR "market trends"'],
  fitness: ['fitness OR workout OR gym OR protein', 'health fitness training'],
  photography: ['camera OR Lightroom OR portrait photography OR lens', 'photography editing camera'],
  filmmaking: ['"filmmaking tutorial" OR "behind the scenes" OR "how it was shot" OR cinematography OR "video editing"', '"film production" OR capcut OR premiere pro'],
  geopolitics: ['elections OR diplomacy OR defense OR geopolitics', 'world news international relations'],
  travel: ['"hidden beaches" OR "trek no one talks about" OR "hidden gems" OR "secret hikes"', '"travel itinerary" OR "backpacking guide" OR "budget travel" OR "travel hacks" OR offbeat'],
  food: ['food OR recipe OR restaurant OR street food', 'cooking viral food'],
  sports: ['football OR cricket OR FIFA OR F1 OR tennis', 'sports match league'],
  music: ['music OR Spotify OR song OR album OR concert', 'viral songs'],
  'movies & entertainment': ['movie OR trailer OR OTT OR box office OR series', 'entertainment celebrity'],
  general: ['trending news viral'],
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

function newsUrl(query, geo) {
  const locale = NEWS_LOCALE[geo] || NEWS_LOCALE.US
  const q = `${query} when:7d`
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`
}

async function fetchTrends(region, niche) {
  const geo = getGeo(region)
  let queries = NICHE_QUERIES[niche] || NICHE_QUERIES.general
  
  if (niche === 'travel') {
    if (geo === 'IN') {
      queries = [
        `("hidden beaches" OR "trek no one talks about" OR "hidden gems" OR "secret hikes") AND (India OR Goa OR Himalayas OR Ladakh OR Western Ghats OR Kerala OR Himachal)`,
        `("travel itinerary" OR "backpacking guide" OR "budget travel" OR "travel hacks" OR offbeat) AND (India OR Indian OR Delhi OR Mumbai OR Bangalore)`
      ]
    } else {
      queries = [
        `("hidden beaches" OR "trek no one talks about" OR "hidden gems" OR "secret hikes") AND NOT (India OR Goa OR Himalayas OR Ladakh)`,
        `("travel itinerary" OR "backpacking guide" OR "budget travel" OR "travel hacks" OR offbeat) AND NOT (India OR Indian OR Delhi OR Mumbai OR Bangalore)`
      ]
    }
  } else if (niche === 'fitness') {
    if (geo === 'IN') {
      queries = queries.map(q => `(${q}) AND (India OR Indian)`)
    } else {
      queries = queries.map(q => `(${q}) AND NOT (India OR Indian)`)
    }
  }
  const urls = [
    `https://trends.google.com/trending/rss?geo=${geo}`,
    ...queries.slice(0, 2).map(query => newsUrl(query, geo)),
    // Inject a dedicated query that specifically hunts for viral Instagram Reels in this niche!
    newsUrl(`(${queries[0]}) AND (Instagram OR Reels OR TikTok OR viral)`, geo)
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