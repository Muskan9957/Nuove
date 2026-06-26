// ─── IP-based region detection ────────────────────────────────────
// Uses ipapi.co free tier (1000 req/day) — no API key needed.
// Runs once on first use, result saved to localStorage forever.
// Region values MUST match the backend region map (ai-reel-coach/src/services/trendsV2/regions.js).

const COUNTRY_TO_REGION = {
  IN: 'India',
  US: 'US',
  CA: 'Canada',
  GB: 'UK', IE: 'UK',
  AU: 'Australia', NZ: 'Australia',
  JP: 'Japan',
  KR: 'South Korea',
  ID: 'Indonesia',
  BR: 'Brazil',
  MX: 'Mexico',
  DE: 'Germany', AT: 'Germany', CH: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NG: 'Nigeria',
  PH: 'Philippines',
  SG: 'Singapore',
  AE: 'UAE',
  SA: 'Saudi Arabia',
  PK: 'Pakistan',
  // Grouped regions for countries we don't list individually
  KW: 'Middle East', QA: 'Middle East', BH: 'Middle East', OM: 'Middle East',
  EG: 'Middle East', JO: 'Middle East', LB: 'Middle East',
  MY: 'Southeast Asia', TH: 'Southeast Asia', VN: 'Southeast Asia',
  MM: 'Southeast Asia', KH: 'Southeast Asia',
}

const STORAGE_KEY = 'arc_audience'

export async function detectAndSaveRegion() {
  // Already set — don't overwrite user's choice
  if (localStorage.getItem(STORAGE_KEY)) return localStorage.getItem(STORAGE_KEY)

  try {
    const res  = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
    const data = await res.json()
    const region = COUNTRY_TO_REGION[data.country_code] || 'Global'
    localStorage.setItem(STORAGE_KEY, region)
    return region
  } catch {
    // Detection failed silently — leave blank so user sets manually
    return null
  }
}

export function getSavedRegion() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function saveRegion(region) {
  localStorage.setItem(STORAGE_KEY, region)
}

// Country list for the region picker. Values match the backend region map.
export const REGIONS = [
  { value: 'India',          label: '🇮🇳 India'          },
  { value: 'Global',         label: '🌐 Global'          },
  { value: 'US',             label: '🇺🇸 United States'  },
  { value: 'UK',             label: '🇬🇧 United Kingdom' },
  { value: 'Canada',         label: '🇨🇦 Canada'         },
  { value: 'Australia',      label: '🇦🇺 Australia'      },
  { value: 'Japan',          label: '🇯🇵 Japan'          },
  { value: 'South Korea',    label: '🇰🇷 South Korea'    },
  { value: 'Indonesia',      label: '🇮🇩 Indonesia'      },
  { value: 'Brazil',         label: '🇧🇷 Brazil'         },
  { value: 'Mexico',         label: '🇲🇽 Mexico'         },
  { value: 'Germany',        label: '🇩🇪 Germany'        },
  { value: 'France',         label: '🇫🇷 France'         },
  { value: 'Spain',          label: '🇪🇸 Spain'          },
  { value: 'Italy',          label: '🇮🇹 Italy'          },
  { value: 'Nigeria',        label: '🇳🇬 Nigeria'        },
  { value: 'Philippines',    label: '🇵🇭 Philippines'    },
  { value: 'Singapore',      label: '🇸🇬 Singapore'      },
  { value: 'UAE',            label: '🇦🇪 UAE'            },
  { value: 'Saudi Arabia',   label: '🇸🇦 Saudi Arabia'   },
  { value: 'Pakistan',       label: '🇵🇰 Pakistan'       },
  { value: 'Middle East',    label: '🌍 Middle East'     },
  { value: 'Southeast Asia', label: '🌏 Southeast Asia'  },
]
