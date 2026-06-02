// ─── trendsService.js — Real-time trend data from live sources ────────────────
// Sources:
//   1. Google Trends Daily RSS  (no API key, completely free)
//   2. YouTube Data API v3      (free Google key, 10k units/day)
//   3. Spotify Web API          (free client credentials flow)
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https')

// ── Region → geo code (Google Trends + YouTube regionCode) ───────────────────
const REGION_GEO = {
  India:           'IN',
  US:              'US',
  UK:              'GB',
  Australia:       'AU',
  Canada:          'CA',
  UAE:             'AE',
  'Middle East':   'AE',
  'Southeast Asia':'SG',
  Singapore:       'SG',
  Nigeria:         'NG',
  Global:          'US',
}

// ── Niche → YouTube category ID ───────────────────────────────────────────────
const NICHE_YT_CATEGORY = {
  comedy:        '23',  // Comedy
  fitness:       '17',  // Sports
  finance:       '25',  // News & Politics  (finance news is here)
  food:          '26',  // Howto & Style
  fashion:       '26',  // Howto & Style
  tech:          '28',  // Science & Technology
  lifestyle:     '26',  // Howto & Style
  education:     '27',  // Education
  travel:        '19',  // Travel & Events
  motivation:    '22',  // People & Blogs
  business:      '25',  // News & Politics
  relationships: '22',  // People & Blogs
  general:       '0',   // All categories
}

// ── Simple HTTPS GET helper ───────────────────────────────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GOOGLE TRENDS — daily trending searches by country
//    Returns array of strings like ["Virat Kohli", "Budget 2025", ...]
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGoogleTrends(region = 'India') {
  const geo = REGION_GEO[region] || 'IN'
  const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`

  try {
    const { status, body } = await httpsGet(url)
    if (status !== 200) throw new Error(`status ${status}`)

    // Parse XML — extract <title> tags inside <item> elements
    const items = body.match(/<item>([\s\S]*?)<\/item>/g) || []
    const trends = []

    for (const item of items.slice(0, 20)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         item.match(/<title>(.*?)<\/title>/)
      const trafficMatch = item.match(/approx_traffic[^>]*>(.*?)<\/ht:approx_traffic>/) ||
                           item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)
      if (titleMatch?.[1]) {
        trends.push({
          title:   titleMatch[1].trim(),
          traffic: trafficMatch?.[1]?.trim() || null,
          source:  'google',
        })
      }
    }

    console.log(`[trends] Google Trends (${geo}): ${trends.length} topics`)
    return trends
  } catch (err) {
    console.error('[trends] Google Trends fetch failed:', err.message)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. YOUTUBE TRENDING — most popular videos by country + category
//    Returns array of { title, channelTitle, viewCount }
// ─────────────────────────────────────────────────────────────────────────────
async function fetchYouTubeTrending(region = 'India', niche = 'general') {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.warn('[trends] YOUTUBE_API_KEY not set — skipping YouTube trending')
    return []
  }

  const regionCode  = REGION_GEO[region] || 'IN'
  const categoryId  = NICHE_YT_CATEGORY[niche?.toLowerCase()] || '0'

  const params = new URLSearchParams({
    part:           'snippet,statistics',
    chart:          'mostPopular',
    regionCode,
    maxResults:     '20',
    key:            apiKey,
    ...(categoryId !== '0' && { videoCategoryId: categoryId }),
  })

  const url = `https://www.googleapis.com/youtube/v3/videos?${params}`

  try {
    const { status, body } = await httpsGet(url)
    const json = JSON.parse(body)

    if (status !== 200) {
      console.error('[trends] YouTube API error:', json.error?.message)
      return []
    }

    const videos = (json.items || []).map(v => ({
      title:        v.snippet?.title || '',
      channel:      v.snippet?.channelTitle || '',
      views:        v.statistics?.viewCount || '0',
      publishedAt:  v.snippet?.publishedAt || '',
      source:       'youtube',
    }))

    console.log(`[trends] YouTube Trending (${regionCode}, cat=${categoryId}): ${videos.length} videos`)
    return videos
  } catch (err) {
    console.error('[trends] YouTube Trending fetch failed:', err.message)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SPOTIFY TRENDING AUDIO — viral tracks for Reels/Shorts
//    Uses Client Credentials flow (no user login needed)
//    Returns array of { name, artist, popularity, previewUrl }
// ─────────────────────────────────────────────────────────────────────────────

let spotifyToken = null
let spotifyTokenExpiry = 0

async function getSpotifyToken() {
  const clientId     = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const body        = 'grant_type=client_credentials'

  return new Promise((resolve) => {
    const req = https.request(
      'https://accounts.spotify.com/api/token',
      {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            spotifyToken       = json.access_token
            spotifyTokenExpiry = Date.now() + (json.expires_in - 60) * 1000
            resolve(spotifyToken)
          } catch { resolve(null) }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.write(body)
    req.end()
  })
}

// Country code → Spotify market + viral playlist ID
const SPOTIFY_VIRAL_PLAYLISTS = {
  IN: '37i9dQZEVXbLZ52XmnySJg',  // Viral 50 India
  US: '37i9dQZEVXbLiRSasKsNU9',  // Viral 50 USA
  GB: '37i9dQZEVXbIQnj7RRhdSX',  // Viral 50 UK
  AU: '37i9dQZEVXbIg9P1yiE1A1',  // Viral 50 Australia
  CA: '37i9dQZEVXbKj23U1GF4IR',  // Viral 50 Canada
  AE: '37i9dQZEVXbM4UZuIrvHvA',  // Viral 50 UAE
  SG: '37i9dQZEVXbK4gjvS1FjPY',  // Viral 50 Singapore
  // Fallback for unsupported regions
  _default: '37i9dQZEVXbLiRSasKsNU9', // Viral 50 USA
}

async function fetchSpotifyTrendingAudio(region = 'India') {
  const token = await getSpotifyToken()
  if (!token) {
    console.warn('[trends] Spotify credentials not set — skipping audio trends')
    return []
  }

  const geo        = REGION_GEO[region] || 'IN'
  const playlistId = SPOTIFY_VIRAL_PLAYLISTS[geo] || SPOTIFY_VIRAL_PLAYLISTS['_default']
  const url        = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=20&fields=items(track(name,artists,popularity,preview_url,external_urls))`

  try {
    const { status, body } = await httpsGet(url, { 'Authorization': `Bearer ${token}` })
    const json = JSON.parse(body)

    if (status !== 200) {
      console.error('[trends] Spotify API error:', json.error?.message)
      return []
    }

    const tracks = (json.items || [])
      .filter(i => i?.track?.name)
      .map((item, idx) => ({
        rank:       idx + 1,
        name:       item.track.name,
        artist:     item.track.artists?.map(a => a.name).join(', ') || 'Unknown',
        popularity: item.track.popularity || 0,
        spotifyUrl: item.track.external_urls?.spotify || null,
        source:     'spotify',
      }))

    console.log(`[trends] Spotify Viral 50 (${geo}): ${tracks.length} tracks`)
    return tracks
  } catch (err) {
    console.error('[trends] Spotify fetch failed:', err.message)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  fetchGoogleTrends,
  fetchYouTubeTrending,
  fetchSpotifyTrendingAudio,
  REGION_GEO,
  NICHE_YT_CATEGORY,
}
