const axios = require('axios')

// region label → ISO 3166-1 country code for YouTube API
const REGION_CODE = {
  India: 'IN', US: 'US', UK: 'GB', 'Middle East': 'AE',
  'Southeast Asia': 'ID', Global: 'US',
}

const getRegionCode = (region) => REGION_CODE[region] || 'IN'

// ─── Fetch real trending short-form video titles for a niche/region ─
// Uses YouTube Data API v3 search (most-viewed shorts in the last 7 days).
// Returns an array of real video titles, or [] if unavailable.
const getTrendingTitles = async (niche = 'general', region = 'India') => {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return []

  const isGeneral = (!niche || niche === 'general')

  try {
    if (isGeneral) {
      // For general trends, fetch ACTUAL top trending videos in the country
      // This captures real macro-trends (movie trailers, viral events, music, etc.)
      const resp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          key,
          part: 'snippet',
          chart: 'mostPopular',
          regionCode: getRegionCode(region),
          maxResults: 15,
        },
        timeout: 8000,
      })
      return (resp.data.items || [])
        .map(it => it.snippet?.title)
        .filter(Boolean)
    } else {
      // For specific niches, search for the most viewed Shorts in the last 7 days
      const publishedAfter = new Date(Date.now() - 7 * 86400000).toISOString()
      const resp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key,
          part          : 'snippet',
          q             : niche,
          type          : 'video',
          videoDuration : 'short',
          order         : 'viewCount',
          regionCode    : getRegionCode(region),
          relevanceLanguage: 'en',
          publishedAfter,
          maxResults    : 15,
        },
        timeout: 8000,
      })
      return (resp.data.items || [])
        .map(it => it.snippet?.title)
        .filter(Boolean)
    }
  } catch (err) {
    console.error('[YouTube] search error:', err.response?.data?.error?.message || err.message)
    return []
  }
}

module.exports = { getTrendingTitles }
