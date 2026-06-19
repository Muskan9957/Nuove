// ─── TwitterTrendProvider — abstraction stub ──────────────────────────────────
// Plug in TWITTER_BEARER_TOKEN when Twitter API v2 access is available.
// Currently returns [] so callers degrade gracefully.
//
// When implementing:
// Use GET /2/trends/by/woeid/{id} (v1.1 compatible layer) or
// GET /2/tweets/search/recent with trend keywords for v2.

async function fetchTrends(region, niche) {
  if (!process.env.TWITTER_BEARER_TOKEN) return []

  // TODO: Implement when TWITTER_BEARER_TOKEN is available
  // const WOEID = { India: 23424848, US: 23424977, UK: 23424975, Global: 1 }
  // const woeid = WOEID[region] || WOEID.Global
  // ...

  return []
}

module.exports = { fetchTrends }