// Single source of truth for per-country trend sourcing.
// Region values are the human names used by the frontend selector and the
// trend cache keys. `yt` = YouTube/Google geo (ISO 3166-1 alpha-2),
// `lang` = primary content language, `news` = Google News locale params.
const REGIONS = {
  'India':          { yt: 'IN', lang: 'en', news: { hl: 'en-IN',  gl: 'IN', ceid: 'IN:en' } },
  'US':             { yt: 'US', lang: 'en', news: { hl: 'en-US',  gl: 'US', ceid: 'US:en' } },
  'UK':             { yt: 'GB', lang: 'en', news: { hl: 'en-GB',  gl: 'GB', ceid: 'GB:en' } },
  'Canada':         { yt: 'CA', lang: 'en', news: { hl: 'en-CA',  gl: 'CA', ceid: 'CA:en' } },
  'Australia':      { yt: 'AU', lang: 'en', news: { hl: 'en-AU',  gl: 'AU', ceid: 'AU:en' } },
  'Japan':          { yt: 'JP', lang: 'ja', news: { hl: 'ja',     gl: 'JP', ceid: 'JP:ja' } },
  'South Korea':    { yt: 'KR', lang: 'ko', news: { hl: 'ko',     gl: 'KR', ceid: 'KR:ko' } },
  'Indonesia':      { yt: 'ID', lang: 'id', news: { hl: 'id',     gl: 'ID', ceid: 'ID:id' } },
  'Brazil':         { yt: 'BR', lang: 'pt', news: { hl: 'pt-BR',  gl: 'BR', ceid: 'BR:pt-419' } },
  'Mexico':         { yt: 'MX', lang: 'es', news: { hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' } },
  'Germany':        { yt: 'DE', lang: 'de', news: { hl: 'de',     gl: 'DE', ceid: 'DE:de' } },
  'France':         { yt: 'FR', lang: 'fr', news: { hl: 'fr',     gl: 'FR', ceid: 'FR:fr' } },
  'Spain':          { yt: 'ES', lang: 'es', news: { hl: 'es',     gl: 'ES', ceid: 'ES:es' } },
  'Italy':          { yt: 'IT', lang: 'it', news: { hl: 'it',     gl: 'IT', ceid: 'IT:it' } },
  'Nigeria':        { yt: 'NG', lang: 'en', news: { hl: 'en-NG',  gl: 'NG', ceid: 'NG:en' } },
  'Philippines':    { yt: 'PH', lang: 'en', news: { hl: 'en-PH',  gl: 'PH', ceid: 'PH:en' } },
  'Singapore':      { yt: 'SG', lang: 'en', news: { hl: 'en-SG',  gl: 'SG', ceid: 'SG:en' } },
  'UAE':            { yt: 'AE', lang: 'en', news: { hl: 'en-AE',  gl: 'AE', ceid: 'AE:en' } },
  'Saudi Arabia':   { yt: 'SA', lang: 'ar', news: { hl: 'ar',     gl: 'SA', ceid: 'SA:ar' } },
  'Pakistan':       { yt: 'PK', lang: 'en', news: { hl: 'en-PK',  gl: 'PK', ceid: 'PK:en' } },
  // Legacy regional groupings — kept so already-saved user regions still resolve.
  'Middle East':    { yt: 'AE', lang: 'en', news: { hl: 'en-AE',  gl: 'AE', ceid: 'AE:en' } },
  'Southeast Asia': { yt: 'ID', lang: 'en', news: { hl: 'en-ID',  gl: 'ID', ceid: 'ID:en' } },
};

// Unknown / 'Global' regions default to US sourcing (Global is handled by a
// dedicated multi-region blend in the providers).
function regionConfig(region) {
  return REGIONS[region] || REGIONS['US'];
}

module.exports = { REGIONS, regionConfig };
