import { useLang } from '../i18n.jsx'

const LANGUAGES = [
  { code: 'en', label: 'English'   },
  { code: 'hi', label: 'हिंदी'    },
  { code: 'es', label: 'Español'   },
  { code: 'fr', label: 'Français'  },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch'   },
  { code: 'ar', label: 'العربية'  },
  { code: 'id', label: 'Bahasa'    },
  { code: 'ja', label: '日本語'    },
  { code: 'ko', label: '한국어'    },
]

export default function LanguageSelector({ compact = false }) {
  const { lang, setLanguage } = useLang()

  if (compact) {
    return (
      <select
        value={lang}
        onChange={e => setLanguage(e.target.value)}
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          padding: '4px 8px',
          fontSize: '0.8rem',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => setLanguage(l.code)}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: lang === l.code ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: lang === l.code ? 'var(--accent-dim)' : 'var(--surface2)',
            color: lang === l.code ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: lang === l.code ? 600 : 400,
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
