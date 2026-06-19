const axios = require('axios')
const { getSpotifyToken } = require('../../trendsService')

// ─── Spotify region → market code + Viral 50 playlist ID ─────────────────────
// Viral 50 playlist IDs per region (official Spotify editorial playlists)
const REGION_PLAYLISTS = {
  India:          '37i9dQZF1DX0XUsuxWHRQd',  // Viral 50 India
  Global:         '37i9dQZEVXbLiRSasKsNU9',  // Viral 50 Global
  US:             '37i9dQZEVXbLiRSasKsNU9',  // Viral 50 Global (no US-only list)
  UK:             '37i9dQZF1DXcDctz6kJ8xS',  // Viral 50 UK
  'Middle East':  '37i9dQZF1DX0XUsuxWHRQd',  // Fallback to India
  'Southeast Asia': '37i9dQZF1DX0XUsuxWHRQd', // Fallback
}

/**
 * Fetch top Spotify Viral 50 tracks for a region.
 * Returns array: { title, artist, popularity, spotifyUrl }
 * Returns [] if Spotify unavailable.
 */
async function fetchTrends(region = 'India', niche) {
  const token = await getSpotifyToken()
  if (!token) return []

  const playlistId = REGION_PLAYLISTS[region] || REGION_PLAYLISTS.Global

  try {
    const resp = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'items(track(name,artists,popularity,external_urls))', limit: 20 },
      timeout: 8000,
    })

    return (resp.data.items || []).map(item => ({
      title:      item.track?.name,
      artist:     item.track?.artists?.map(a => a.name).join(', '),
      popularity: item.track?.popularity || 0,
      spotifyUrl: item.track?.external_urls?.spotify,
    })).filter(s => s.title)
  } catch (err) {
    console.warn('[Spotify] signal fetch error:', err.message)
    return []
  }
}

module.exports = { fetchTrends }