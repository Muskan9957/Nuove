const axios = require('axios')

// ─── Client-credentials token (cached in-memory until expiry) ──────
let cachedToken = null
let tokenExpiry = 0

const getToken = async () => {
  const id     = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) return null

  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  try {
    const auth = Buffer.from(`${id}:${secret}`).toString('base64')
    const resp = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
    )
    cachedToken = resp.data.access_token
    tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000 // refresh 1 min early
    return cachedToken
  } catch (err) {
    console.error('[Spotify] token error:', err.response?.data || err.message)
    return null
  }
}

// ─── Search a single track ─────────────────────────────────────────
const searchTrack = async (query, token) => {
  try {
    const resp = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${token}` },
      params : { q: query, type: 'track', limit: 1, market: 'IN' },
      timeout: 8000,
    })
    const track = resp.data?.tracks?.items?.[0]
    if (!track) return null
    return {
      spotifyUrl : track.external_urls?.spotify || null,
      spotifyId  : track.id,
      previewUrl : track.preview_url || null,
      albumArt   : track.album?.images?.[0]?.url || null,
      verifiedTitle : track.name,
      verifiedArtist: track.artists?.map(a => a.name).join(', '),
    }
  } catch {
    return null
  }
}

// ─── Enrich AI-suggested songs with real Spotify data ──────────────
// Only enriches non-royalty-free (real, named) tracks. Royalty-free
// library picks are left as-is. Never throws — returns input on failure.
const enrichSongs = async (songs) => {
  if (!Array.isArray(songs) || songs.length === 0) return songs
  const token = await getToken()
  if (!token) return songs

  const enriched = await Promise.all(
    songs.map(async (s) => {
      if (s.royaltyFree || !s.title || s.artist === 'Various') return s
      const data = await searchTrack(`${s.title} ${s.artist}`, token)
      return data ? { ...s, ...data } : s
    })
  )
  return enriched
}

// ─── Search multiple tracks (real-time search bar) ──────────────────
const searchTracks = async (query, limit = 8) => {
  const token = await getToken();
  if (!token) return [];
  try {
    const resp = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${token}` },
      params : { q: query, type: 'track', limit, market: 'IN' },
      timeout: 8000,
    })
    const items = resp.data?.tracks?.items || []
    return items.map(track => ({
      title: track.name,
      artist: track.artists?.map(a => a.name).join(', '),
      spotifyUrl : track.external_urls?.spotify || null,
      spotifyId  : track.id,
      previewUrl : track.preview_url || null,
      albumArt   : track.album?.images?.[0]?.url || null,
      royaltyFree: false,
    }))
  } catch (err) {
    console.error('[Spotify] search error:', err.message);
    return [];
  }
}

module.exports = { enrichSongs, getToken, searchTracks }
