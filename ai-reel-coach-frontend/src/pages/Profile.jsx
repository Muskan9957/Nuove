import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getSavedRegion, saveRegion, REGIONS } from '../utils/detectRegion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../components/Toast'
import { api } from '../api'

const PRESET_AVATARS = [
  // Robots
  { url: 'https://api.dicebear.com/8.x/bottts/png?seed=alpha&size=128',           label: 'Alpha'      },
  { url: 'https://api.dicebear.com/8.x/bottts/png?seed=nova&size=128',            label: 'Nova'       },
  { url: 'https://api.dicebear.com/8.x/bottts/png?seed=cyber&size=128',           label: 'Cyber'      },
  { url: 'https://api.dicebear.com/8.x/bottts/png?seed=pixel9&size=128',          label: 'Pixel Bot'  },
  { url: 'https://api.dicebear.com/8.x/bottts/png?seed=titan&size=128',           label: 'Titan'      },
  { url: 'https://api.dicebear.com/8.x/bottts/png?seed=zero&size=128',            label: 'Zero'       },
  { url: 'https://api.dicebear.com/8.x/bottts-neutral/png?seed=steel&size=128',   label: 'Steel'      },
  { url: 'https://api.dicebear.com/8.x/bottts-neutral/png?seed=matrix&size=128',  label: 'Matrix'     },
  // Anime / Illustrated
  { url: 'https://api.dicebear.com/8.x/adventurer/png?seed=sakura&size=128',      label: 'Sakura'     },
  { url: 'https://api.dicebear.com/8.x/adventurer/png?seed=kai&size=128',         label: 'Kai'        },
  { url: 'https://api.dicebear.com/8.x/adventurer/png?seed=luna&size=128',        label: 'Luna'       },
  { url: 'https://api.dicebear.com/8.x/adventurer/png?seed=ryu&size=128',         label: 'Ryu'        },
  { url: 'https://api.dicebear.com/8.x/adventurer/png?seed=hana&size=128',        label: 'Hana'       },
  { url: 'https://api.dicebear.com/8.x/adventurer/png?seed=storm&size=128',       label: 'Storm'      },
  { url: 'https://api.dicebear.com/8.x/adventurer-neutral/png?seed=aria&size=128',label: 'Aria'       },
  { url: 'https://api.dicebear.com/8.x/adventurer-neutral/png?seed=blaze&size=128',label:'Blaze'      },
  // Pixel Art
  { url: 'https://api.dicebear.com/8.x/pixel-art/png?seed=hero&size=128',         label: 'Hero'       },
  { url: 'https://api.dicebear.com/8.x/pixel-art/png?seed=quest&size=128',        label: 'Quest'      },
  { url: 'https://api.dicebear.com/8.x/pixel-art/png?seed=blade&size=128',        label: 'Blade'      },
  { url: 'https://api.dicebear.com/8.x/pixel-art/png?seed=spark&size=128',        label: 'Spark'      },
  { url: 'https://api.dicebear.com/8.x/pixel-art/png?seed=glitch&size=128',       label: 'Glitch'     },
  { url: 'https://api.dicebear.com/8.x/pixel-art/png?seed=retro&size=128',        label: 'Retro'      },
  // Soft / Illustrated
  { url: 'https://api.dicebear.com/8.x/lorelei/png?seed=aurora&size=128',         label: 'Aurora'     },
  { url: 'https://api.dicebear.com/8.x/lorelei/png?seed=mist&size=128',           label: 'Mist'       },
  { url: 'https://api.dicebear.com/8.x/lorelei/png?seed=ember&size=128',          label: 'Ember'      },
  { url: 'https://api.dicebear.com/8.x/lorelei/png?seed=dusk&size=128',           label: 'Dusk'       },
  { url: 'https://api.dicebear.com/8.x/lorelei/png?seed=dawn&size=128',           label: 'Dawn'       },
  { url: 'https://api.dicebear.com/8.x/lorelei/png?seed=sol&size=128',            label: 'Sol'        },
  // Fun / Expressive
  { url: 'https://api.dicebear.com/8.x/fun-emoji/png?seed=joy&size=128',          label: 'Joy'        },
  { url: 'https://api.dicebear.com/8.x/fun-emoji/png?seed=cool&size=128',         label: 'Cool'       },
  { url: 'https://api.dicebear.com/8.x/fun-emoji/png?seed=fire&size=128',         label: 'Fire'       },
  { url: 'https://api.dicebear.com/8.x/fun-emoji/png?seed=chill&size=128',        label: 'Chill'      },
  // Geometric / Abstract
  { url: 'https://api.dicebear.com/8.x/rings/png?seed=neon1&size=128',            label: 'Neon Ring'  },
  { url: 'https://api.dicebear.com/8.x/rings/png?seed=pulse&size=128',            label: 'Pulse'      },
  { url: 'https://api.dicebear.com/8.x/rings/png?seed=wave&size=128',             label: 'Wave'       },
  { url: 'https://api.dicebear.com/8.x/rings/png?seed=vibe&size=128',             label: 'Vibe'       },
  { url: 'https://api.dicebear.com/8.x/shapes/png?seed=zen&size=128',             label: 'Zen'        },
  { url: 'https://api.dicebear.com/8.x/shapes/png?seed=arc&size=128',             label: 'Arc'        },
  { url: 'https://api.dicebear.com/8.x/shapes/png?seed=dot&size=128',             label: 'Dot'        },
  { url: 'https://api.dicebear.com/8.x/shapes/png?seed=flow&size=128',            label: 'Flow'       },
  // Croodles (Doodle style)
  { url: 'https://api.dicebear.com/8.x/croodles/png?seed=sketch&size=128',        label: 'Sketch'     },
  { url: 'https://api.dicebear.com/8.x/croodles/png?seed=doodle&size=128',        label: 'Doodle'     },
  { url: 'https://api.dicebear.com/8.x/croodles/png?seed=ink&size=128',           label: 'Ink'        },
  { url: 'https://api.dicebear.com/8.x/croodles/png?seed=brush&size=128',         label: 'Brush'      },
  // Thumbs (Unique style)
  { url: 'https://api.dicebear.com/8.x/thumbs/png?seed=ace&size=128',             label: 'Ace'        },
  { url: 'https://api.dicebear.com/8.x/thumbs/png?seed=bold&size=128',            label: 'Bold'       },
  { url: 'https://api.dicebear.com/8.x/thumbs/png?seed=vivid&size=128',           label: 'Vivid'      },
  { url: 'https://api.dicebear.com/8.x/thumbs/png?seed=prime&size=128',           label: 'Prime'      },
]

const PLAN_META = {
  FREE:    { label: 'Free',    color: '#FF2D6F', bg: 'rgba(255,45,111,0.12)', limit: 10  },
  STARTER: { label: 'Starter', color: '#00D4B1', bg: 'rgba(0,212,177,0.12)',  limit: 50  },
  PRO:     { label: 'Pro',     color: '#B36DFF', bg: 'rgba(179,109,255,0.12)', limit: 999 },
}

function Avatar({ user, size = 80 }) {
  const initials = (user?.name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return user?.avatar ? (
    <img src={user.avatar} alt={user.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #FF5F1F, #FF3CAC)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-head)',
      fontWeight: 800,
      fontSize: size * 0.34,
      color: '#fff',
      letterSpacing: '-0.02em',
      flexShrink: 0,
      boxShadow: '0 4px 16px rgba(255,60,172,0.3)',
    }}>
      {initials}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-faint)',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ icon, label, value, action }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 36, height: 36,
        background: 'var(--surface2)',
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

const SKIN_COLORS   = ['Tanned','Yellow','Pale','Light','Brown','DarkBrown','Black']
const MALE_HAIR     = ['ShortHairShortFlat','ShortHairShortCurly','ShortHairShortRound','ShortHairShortWaved','ShortHairDreads01','ShortHairFrizzle','ShortHairTheCaesar','ShortHairSides','NoHair']
const MALE_LABELS   = ['Flat','Curly','Round','Waved','Dreads','Frizzle','Caesar','Sides','Bald']
const FEMALE_HAIR   = ['LongHairStraight','LongHairCurly','LongHairBob','LongHairBun','LongHairFro','LongHairBigHair','LongHairMiaWallace','LongHairNotTooLong','LongHairFroBand','Hijab','NoHair']
const FEMALE_LABELS = ['Straight','Curly','Bob','Bun','Fro','Big Hair','Mia','Medium','Band','Hijab','Bald']
const HAIR_COLORS   = ['Black','Brown','BrownDark','Auburn','Blonde','BlondeGolden','Red','SilverGray','PastelPink','Platinum']
const EYE_TYPES     = ['Default','Happy','Wink','Hearts','Squint','Side','Surprised','Close','EyeRoll']
const MOUTH_TYPES   = ['Smile','Default','Twinkle','Tongue','Serious','Sad','Grimace','Disbelief']
const CLOTHES       = ['Hoodie','BlazerShirt','GraphicShirt','ShirtCrewNeck','ShirtVNeck','Overall','CollarSweater','BlazerSweater']
const CLOTHES_LABEL = ['Hoodie','Blazer','Graphic','Crew','V-Neck','Overall','Sweater','Suit']
const ACCESSORIES   = ['Blank','Sunglasses','Prescription01','Prescription02','Round','Wayfarers','Kurt']
const ACC_LABELS    = ['None','Sunglasses','Glasses','Oval','Round','Wayfarers','Kurt']
const CLOTH_COLORS  = ['Blue03','Red','Black','Heather','White','Pink','PastelBlue','PastelGreen','Gray01','PastelYellow']

const SKIN_HEX = { Tanned:'#FD9841', Yellow:'#F9CA5F', Pale:'#FADDBB', Light:'#EDB98A', Brown:'#D08B5B', DarkBrown:'#AE5D29', Black:'#614335' }
const HAIR_HEX = { Black:'#2C1B18', Brown:'#724133', BrownDark:'#4A312C', Auburn:'#A55728', Blonde:'#B58143', BlondeGolden:'#D6B370', Red:'#C93305', SilverGray:'#E8E1E1', PastelPink:'#F59797', Platinum:'#EFEFEF' }
const CLOTH_HEX = { Blue03:'#25557C', Red:'#FF5C5C', Black:'#262E33', Heather:'#B7C1DB', White:'#E6E6E6', Pink:'#FF488E', PastelBlue:'#B1E2FF', PastelGreen:'#A7D2A5', Gray01:'#858585', PastelYellow:'#FFDEB5' }

function buildAvatarUrl(opts) {
  const p = new URLSearchParams({
    avatarStyle:    'Circle',
    topType:        opts.hair,
    hairColor:      opts.hairColor,
    facialHairType: 'Blank',
    accessoriesType:opts.accessories,
    clotheType:     opts.clothes,
    clotheColor:    opts.clotheColor,
    eyeType:        opts.eyes,
    eyebrowType:    'Default',
    mouthType:      opts.mouth,
    skinColor:      opts.skin,
  })
  return `https://avataaars.io/?${p.toString()}`
}

const DEFAULT_MALE   = { gender:'male',   skin:'Light', hair:'ShortHairShortFlat', hairColor:'Brown',  eyes:'Default', mouth:'Smile', clothes:'Hoodie', clotheColor:'Blue03', accessories:'Blank' }
const DEFAULT_FEMALE = { gender:'female', skin:'Light', hair:'LongHairStraight',   hairColor:'Brown',  eyes:'Default', mouth:'Smile', clothes:'BlazerShirt', clotheColor:'Pink', accessories:'Blank' }
const DEFAULT_CUSTOM = DEFAULT_MALE

export default function Profile() {
  const { user, logout }   = useAuth()
  const { theme, toggle }  = useTheme()
  const navigate           = useNavigate()
  const toast              = useToast()
  const [liveStreak, setLiveStreak] = useState(null)
  const [totalScripts, setTotalScripts] = useState(0)
  const [totalLogs, setTotalLogs]       = useState(0)
  const [totalBadges, setTotalBadges]   = useState(0)

  useEffect(() => {
    api.getUserProfile().then(p => {
      const s = p?.user?.streak ?? p?.streak
      if (s != null) setLiveStreak(s)
    }).catch(() => {})

    api.getScripts().then(s => {
      if (s?.scripts) setTotalScripts(s.scripts.length)
    }).catch(() => {})

    api.perfHistory().then(p => {
      if (p?.logs) setTotalLogs(p.logs.length)
    }).catch(() => {})

    api.getBadges().then(b => {
      if (b?.badges) setTotalBadges(b.badges.length)
    }).catch(() => {})

    // Listen for real-time streak updates from other pages
    const onStreakUpdate = (e) => {
      if (e.detail != null) setLiveStreak(e.detail)
    }
    window.addEventListener('streak-updated', onStreakUpdate)
    return () => window.removeEventListener('streak-updated', onStreakUpdate)
  }, [])

  const [showDanger, setShowDanger]         = useState(false)
  const [showAvatarGen, setShowAvatarGen]   = useState(false)
  const [subData, setSubData]               = useState(null)
  const [subLoading, setSubLoading]         = useState(false)
  const [cancelConfirm, setCancelConfirm]   = useState(false)
  const [cancelling, setCancelling]         = useState(false)

  useEffect(() => {
    if (user?.plan && user.plan !== 'FREE') {
      setSubLoading(true)
      api.getSubscription()
        .then(d => setSubData(d))
        .catch(() => {})
        .finally(() => setSubLoading(false))
    }
  }, [user?.plan])

  const handleCancelSub = async () => {
    setCancelling(true)
    try {
      await api.cancelSubscription()
      toast('Subscription cancelled ,  you keep access until the end of your billing period.', 'success')
      setCancelConfirm(false)
      // Refresh subscription data
      const d = await api.getSubscription()
      setSubData(d)
    } catch (err) {
      toast(err.message || 'Could not cancel. Please try again.', 'error')
    } finally {
      setCancelling(false)
    }
  }
  const [avatarTab, setAvatarTab]         = useState('gallery') // 'gallery' | 'custom'
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [custom, setCustom]               = useState(DEFAULT_CUSTOM)

  const [region, setRegion] = useState(getSavedRegion)

  const handleRegionChange = (e) => {
    setRegion(e.target.value)
    saveRegion(e.target.value)
    toast('Region saved!', 'success')
  }

  const prefs = (() => { try { return JSON.parse(localStorage.getItem('vs_prefs') || '{}') } catch { return {} } })()
  const planMeta = PLAN_META[user?.plan] || PLAN_META.FREE
  const usagePercent = Math.min(100, Math.round((user?.generationsUsed / planMeta.limit) * 100))
  const joinDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ', '

  const handleLogout = () => {
    logout()
    navigate('/')
    toast('Logged out successfully', 'success')
  }

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [showDeleteWarning, setShowDeleteWarning] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') return
    setDeleting(true)
    try {
      await api.deleteAccount()
      logout()
      navigate('/')
      toast('Your account has been permanently deleted.', 'success')
    } catch (err) {
      toast(err.message || 'Could not delete account. Try again.', 'error')
      setDeleting(false)
    }
  }

  const handleSaveAvatar = async () => {
    if (!selectedAvatar) return
    try {
      await api.saveAvatar(selectedAvatar)
      toast('Avatar updated!', 'success')
      setShowAvatarGen(false)
      setSelectedAvatar(null)
      window.location.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 40px' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,95,31,0.08), rgba(255,60,172,0.06))',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '36px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* bg decoration */}
        <div style={{
          position: 'absolute', right: -40, top: -40,
          width: 180, height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,60,172,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Avatar user={user} size={80} />
          </div>
          <button
            onClick={() => setShowAvatarGen(true)}
            style={{
              background: 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              padding: '6px 12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}
          >
            ✦ AI Avatar
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0, marginBottom: 0 }}>
              {user?.name || 'Creator'}
            </h1>
            <span style={{
              background: planMeta.bg,
              color: planMeta.color,
              fontSize: '0.68rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 10px',
              borderRadius: 99,
            }}>
              {planMeta.label}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>{user?.email}</div>

          {/* Usage bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Monthly scripts</span>
              <span style={{ fontSize: '0.75rem', color: usagePercent >= 80 ? '#ff6b6b' : 'var(--text-muted)', fontWeight: 600 }}>
                {user?.generationsUsed} / {planMeta.limit === 999 ? '∞' : planMeta.limit}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${usagePercent}%`,
                background: usagePercent >= 80
                  ? 'linear-gradient(90deg, #FF9933, #ff4444)'
                  : 'linear-gradient(90deg, #00C8FF, #7B5CF0)',
                borderRadius: 99,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Day Streak',       value: `${liveStreak ?? user?.streak ?? 0}🔥`,    sub: 'Active daily' },
          { label: 'Scripts Written',  value: totalScripts,   sub: 'All time' },
          { label: 'Videos Analysed',  value: totalLogs,      sub: 'All time' },
          { label: 'Badges Earned',    value: totalBadges,    sub: 'Achievements' },
          { label: 'Member Since',     value: joinDate.split(' ')[2] || '2025', sub: joinDate.split(' ').slice(0,2).join(' ') },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-head)',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.03em',
              marginBottom: 2,
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Account info */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 24px', marginBottom: 16 }}>
        <Section title="Account">
          <Row icon="👤" label="Full name"    value={user?.name || 'Not set'} />
          <Row icon="📧" label="Email"        value={user?.email || ', '} />
          <Row icon="🌐" label="Language" value={user?.language === 'hi' ? 'Hindi' : user?.language === 'en-IN' ? 'Hinglish' : 'English'} />
          <Row
            icon="📍"
            label="Content Region"
            value={REGIONS.find(r => r.value === region)?.label || ',  Not set , '}
            action={
              <select
                value={region}
                onChange={handleRegionChange}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <option value="">,  Select , </option>
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            }
          />
          <Row icon="📅" label="Joined"       value={joinDate} />
        </Section>
      </div>

      {/* Plan & Billing */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 24px', marginBottom: 16 }}>
        <Section title="Plan & Billing">

          {/* Current plan row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: user?.plan === 'FREE'
                  ? 'var(--surface2)'
                  : 'linear-gradient(135deg, #00C8FF, #7B5CF0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
              }}>
                {user?.plan === 'FREE' ? '🎯' : '✦'}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                  {planMeta.label} Plan
                  {subData?.subscription?.status === 'cancelled' && (
                    <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#FF9933', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                      · Cancelling
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {planMeta.limit === 999 ? 'Unlimited scripts' : `${planMeta.limit} scripts / month`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {user?.plan === 'FREE' ? (
                <button onClick={() => navigate('/pricing')} className="btn btn-primary btn-sm">
                  Upgrade ↗
                </button>
              ) : (
                <button onClick={() => navigate('/pricing')} className="btn btn-ghost btn-sm">
                  Change plan
                </button>
              )}
            </div>
          </div>

          {/* Free plan upsell */}
          {user?.plan === 'FREE' && (
            <div style={{ padding: '14px 0', display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '1.1rem' }}>💎</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem', marginBottom: 2 }}>
                  Unlock unlimited scripts
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Go Pro for unlimited AI scripts, Content Remix, Creator Advisor & more.
                </div>
              </div>
            </div>
          )}

          {/* Active subscription details */}
          {user?.plan !== 'FREE' && (
            <>
              {subLoading ? (
                <div style={{ padding: '16px 0', color: 'var(--text-faint)', fontSize: '0.82rem' }}>
                  Loading subscription details…
                </div>
              ) : subData?.subscription ? (
                <>
                  {/* Next billing / status */}
                  <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subData.subscription.currentEnd && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {subData.subscription.status === 'cancelled' ? 'Access until' : 'Next billing date'}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(subData.subscription.currentEnd * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Billing cycles paid</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        {subData.subscription.paidCount} / {subData.subscription.totalCount}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '2px 8px', borderRadius: 99,
                        background: subData.subscription.status === 'active'
                          ? 'rgba(34,197,94,0.12)'
                          : subData.subscription.status === 'cancelled'
                          ? 'rgba(255,153,51,0.12)'
                          : 'rgba(107,107,144,0.12)',
                        color: subData.subscription.status === 'active'
                          ? '#22C55E'
                          : subData.subscription.status === 'cancelled'
                          ? '#FF9933'
                          : 'var(--text-muted)',
                      }}>
                        {subData.subscription.status}
                      </span>
                    </div>
                  </div>

                  {/* Payment history */}
                  {subData.payments?.length > 0 && (
                    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Payment History
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {subData.payments.map((p) => (
                          <div key={p.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: p.status === 'captured' ? '#22C55E' : '#ff6b6b',
                              }} />
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                                  ₹{p.amount.toLocaleString('en-IN')}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                                  {new Date(p.createdAt * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {p.method && ` · ${p.method}`}
                                </div>
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                              textTransform: 'uppercase', color: p.status === 'captured' ? '#22C55E' : '#ff6b6b',
                            }}>
                              {p.status === 'captured' ? 'Paid' : p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cancel subscription */}
                  {subData.subscription.status !== 'cancelled' && (
                    <div style={{ padding: '14px 0' }}>
                      {!cancelConfirm ? (
                        <button
                          onClick={() => setCancelConfirm(true)}
                          style={{
                            background: 'none', border: '1px solid rgba(255,107,107,0.25)',
                            color: '#ff6b6b', padding: '8px 16px', borderRadius: 10,
                            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          Cancel subscription
                        </button>
                      ) : (
                        <div style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                            Cancel your subscription?
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                            You'll keep access until the end of your current billing period. No refunds are issued for partial periods.
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => setCancelConfirm(false)}
                              disabled={cancelling}
                              style={{
                                flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)',
                                background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)',
                              }}
                            >
                              Keep subscription
                            </button>
                            <button
                              onClick={handleCancelSub}
                              disabled={cancelling}
                              style={{
                                flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                                background: 'rgba(255,107,107,0.15)', color: '#ff6b6b',
                                cursor: cancelling ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-body)',
                                opacity: cancelling ? 0.7 : 1,
                              }}
                            >
                              {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '14px 0', fontSize: '0.82rem', color: 'var(--text-faint)' }}>
                  Subscription details unavailable ,  contact support if this persists.
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      {/* Preferences */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 24px', marginBottom: 16 }}>
        <Section title="Preferences">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 0',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, background: 'var(--surface2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {theme === 'dark' ? '🌙' : '☀️'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Appearance</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</div>
              </div>
            </div>
            <button onClick={toggle} style={styles.toggle(theme)}>
              <div style={styles.toggleKnob(theme)} />
            </button>
          </div>
        </Section>
      </div>

      {/* Account Actions */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,70,70,0.15)', borderRadius: 20, padding: '8px 24px' }}>
        <Section title="⚠ Account Actions">
          {!showDanger ? (
            <button
              onClick={() => setShowDanger(true)}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, marginTop: 4,
                background: 'transparent',
                border: '1px solid rgba(255,70,70,0.3)',
                color: '#ff6b6b',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              🚪 Sign out of Nuove
            </button>
          ) : (
            <div style={{ padding: '12px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                Are you sure you want to sign out?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowDanger(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleLogout} style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'rgba(255,70,70,0.15)',
                  border: '1px solid rgba(255,70,70,0.3)',
                  color: '#ff6b6b',
                  fontSize: '0.875rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>
                  Yes, sign out
                </button>
              </div>
            </div>
          )}

          {/* Account deletion (privacy / compliance) */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 18 }}>
            <button
              onClick={() => setShowDeleteWarning(true)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: 'transparent',
                border: '1px solid rgba(255,70,70,0.3)', color: '#ff6b6b',
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Permanently delete your account
            </button>
          </div>
        </Section>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarGen && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(4,5,18,0.88)', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAvatarGen(false); setSelectedAvatar(null) } }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border-bright)', borderRadius:24, padding:'24px 20px', width:'100%', maxWidth:540, boxShadow:'0 32px 80px rgba(0,0,0,0.7)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexShrink:0 }}>
              <h2 style={{ fontFamily:'var(--font-head)', fontSize:'1.15rem', fontWeight:800, color:'var(--text)', margin:0 }}>✦ Choose Your Avatar</h2>
              <button onClick={() => { setShowAvatarGen(false); setSelectedAvatar(null) }} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexShrink:0 }}>
              {['gallery','custom'].map(tab => (
                <button key={tab} onClick={() => { setAvatarTab(tab); setSelectedAvatar(null) }} style={{
                  flex:1, padding:'8px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.82rem', fontFamily:'var(--font-body)',
                  background: avatarTab === tab ? 'linear-gradient(135deg,#00C8FF,#7B5CF0)' : 'var(--surface2)',
                  color: avatarTab === tab ? '#fff' : 'var(--text-muted)',
                  transition:'all 0.15s',
                }}>
                  {tab === 'gallery' ? '🖼 Gallery' : '🎨 Custom'}
                </button>
              ))}
            </div>

            {/* Gallery Tab */}
            {avatarTab === 'gallery' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, overflowY:'auto', flex:1, paddingRight:2 }}>
                {PRESET_AVATARS.map((av, i) => (
                  <button key={i} onClick={() => setSelectedAvatar(av.url)} style={{
                    padding:6, borderRadius:12, cursor:'pointer', transition:'all 0.15s',
                    border: selectedAvatar === av.url ? '2px solid var(--accent)' : '2px solid transparent',
                    background: selectedAvatar === av.url ? 'rgba(0,200,255,0.1)' : 'var(--surface2)',
                    boxShadow: selectedAvatar === av.url ? '0 0 10px rgba(0,200,255,0.3)' : 'none',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  }}>
                    <img src={av.url} alt={av.label} style={{ width:68, height:68, borderRadius:8, objectFit:'cover' }} />
                    <span style={{ fontSize:'0.6rem', color: selectedAvatar === av.url ? 'var(--accent)' : 'var(--text-faint)', fontFamily:'var(--font-mono)', fontWeight:600 }}>{av.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Custom Tab */}
            {avatarTab === 'custom' && (
              <div style={{ display:'flex', gap:16, flex:1, overflow:'hidden', minHeight:0 }}>
                {/* Preview */}
                <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                  <div style={{ width:120, height:120, borderRadius:20, overflow:'hidden', background:'var(--surface2)', border:'2px solid var(--border-bright)' }}>
                    <img src={buildAvatarUrl(custom)} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  <button onClick={() => setSelectedAvatar(buildAvatarUrl(custom))} style={{
                    padding:'7px 14px', borderRadius:10, border: selectedAvatar === buildAvatarUrl(custom) ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: selectedAvatar === buildAvatarUrl(custom) ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                    color: selectedAvatar === buildAvatarUrl(custom) ? 'var(--accent)' : 'var(--text-muted)',
                    cursor:'pointer', fontSize:'0.75rem', fontWeight:700,
                  }}>
                    {selectedAvatar === buildAvatarUrl(custom) ? '✓ Selected' : 'Select This'}
                  </button>
                </div>

                {/* Options */}
                <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
                  {/* Gender */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Gender</div>
                    <div style={{ display:'flex', gap:8 }}>
                      {['male','female'].map(g => (
                        <button key={g} onClick={() => setCustom(g === 'male' ? DEFAULT_MALE : DEFAULT_FEMALE)} style={{
                          flex:1, padding:'7px', borderRadius:10, fontWeight:700, fontSize:'0.78rem', cursor:'pointer', fontFamily:'var(--font-body)',
                          border: custom.gender===g ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: custom.gender===g ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                          color: custom.gender===g ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                          {g === 'male' ? '👦 Male' : '👧 Female'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Skin */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Skin Tone</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {SKIN_COLORS.map(s => (
                        <button key={s} onClick={() => setCustom(c => ({...c, skin:s}))} title={s} style={{
                          width:28, height:28, borderRadius:'50%', border: custom.skin===s ? '3px solid var(--accent)' : '2px solid transparent',
                          background: SKIN_HEX[s], cursor:'pointer', transition:'all 0.12s',
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Hair Style */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Hair Style</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {(custom.gender === 'female' ? FEMALE_HAIR : MALE_HAIR).map((h,i) => {
                        const label = custom.gender === 'female' ? FEMALE_LABELS[i] : MALE_LABELS[i]
                        return (
                          <button key={h} onClick={() => setCustom(c => ({...c, hair:h}))} style={{
                            padding:'4px 8px', borderRadius:8, fontSize:'0.65rem', fontWeight:600, cursor:'pointer',
                            border: custom.hair===h ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: custom.hair===h ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                            color: custom.hair===h ? 'var(--accent)' : 'var(--text-muted)',
                          }}>{label}</button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Hair Color */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Hair Color</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {HAIR_COLORS.map(c => (
                        <button key={c} onClick={() => setCustom(cv => ({...cv, hairColor:c}))} title={c} style={{
                          width:24, height:24, borderRadius:'50%', border: custom.hairColor===c ? '3px solid var(--accent)' : '2px solid transparent',
                          background: HAIR_HEX[c], cursor:'pointer',
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Eyes */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Eyes</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {EYE_TYPES.map(e => (
                        <button key={e} onClick={() => setCustom(c => ({...c, eyes:e}))} style={{
                          padding:'4px 8px', borderRadius:8, fontSize:'0.65rem', fontWeight:600, cursor:'pointer',
                          border: custom.eyes===e ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: custom.eyes===e ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                          color: custom.eyes===e ? 'var(--accent)' : 'var(--text-muted)',
                        }}>{e}</button>
                      ))}
                    </div>
                  </div>

                  {/* Mouth */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Mouth</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {MOUTH_TYPES.map(m => (
                        <button key={m} onClick={() => setCustom(c => ({...c, mouth:m}))} style={{
                          padding:'4px 8px', borderRadius:8, fontSize:'0.65rem', fontWeight:600, cursor:'pointer',
                          border: custom.mouth===m ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: custom.mouth===m ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                          color: custom.mouth===m ? 'var(--accent)' : 'var(--text-muted)',
                        }}>{m}</button>
                      ))}
                    </div>
                  </div>

                  {/* Clothes */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Clothes</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {CLOTHES.map((cl,i) => (
                        <button key={cl} onClick={() => setCustom(c => ({...c, clothes:cl}))} style={{
                          padding:'4px 8px', borderRadius:8, fontSize:'0.65rem', fontWeight:600, cursor:'pointer',
                          border: custom.clothes===cl ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: custom.clothes===cl ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                          color: custom.clothes===cl ? 'var(--accent)' : 'var(--text-muted)',
                        }}>{CLOTHES_LABEL[i]}</button>
                      ))}
                    </div>
                  </div>

                  {/* Clothes Color */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Clothes Color</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {CLOTH_COLORS.map(c => (
                        <button key={c} onClick={() => setCustom(cv => ({...cv, clotheColor:c}))} title={c} style={{
                          width:24, height:24, borderRadius:'50%', border: custom.clotheColor===c ? '3px solid var(--accent)' : '2px solid transparent',
                          background: CLOTH_HEX[c], cursor:'pointer',
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Accessories */}
                  <div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Accessories</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {ACCESSORIES.map((a,i) => (
                        <button key={a} onClick={() => setCustom(c => ({...c, accessories:a}))} style={{
                          padding:'4px 8px', borderRadius:8, fontSize:'0.65rem', fontWeight:600, cursor:'pointer',
                          border: custom.accessories===a ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: custom.accessories===a ? 'rgba(0,200,255,0.12)' : 'var(--surface2)',
                          color: custom.accessories===a ? 'var(--accent)' : 'var(--text-muted)',
                        }}>{ACC_LABELS[i]}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save */}
            <div style={{ marginTop:16, flexShrink:0 }}>
              <button onClick={handleSaveAvatar} disabled={!selectedAvatar} className="btn btn-primary" style={{ width:'100%', opacity: selectedAvatar ? 1 : 0.4 }}>
                {selectedAvatar ? 'Set as Avatar ✓' : 'Select an avatar above'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Modal (Step 1) */}
      {showDeleteWarning && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(4,5,18,0.88)', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteWarning(false) }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border-bright)', borderRadius:24, padding:'24px', width:'100%', maxWidth:420, boxShadow:'0 32px 80px rgba(0,0,0,0.7)', textAlign:'center' }}>
            <h2 style={{ fontFamily:'var(--font-head)', fontSize:'1.25rem', fontWeight:800, color:'var(--text)', margin:'0 0 16px' }}>Are you sure?</h2>
            <p style={{ color:'var(--text-muted)', fontSize:'0.95rem', marginBottom:24, lineHeight:1.5 }}>
              Deleting your account is permanent. You will immediately lose access to all your generated scripts, captions, and account data.
            </p>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => setShowDeleteWarning(false)} className="btn btn-ghost" style={{ flex:1, padding:'12px', borderRadius:12 }}>Go Back</button>
              <button onClick={() => { setShowDeleteWarning(false); setShowDeleteConfirmModal(true) }} className="btn btn-primary" style={{ flex:1, padding:'12px', borderRadius:12, background:'#ff4646', color:'#fff', border:'none' }}>Confirm</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal (Step 2) */}
      {showDeleteConfirmModal && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(4,5,18,0.88)', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirmModal(false) }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border-bright)', borderRadius:24, padding:'24px', width:'100%', maxWidth:420, boxShadow:'0 32px 80px rgba(0,0,0,0.7)', textAlign:'center' }}>
            <h2 style={{ fontFamily:'var(--font-head)', fontSize:'1.25rem', fontWeight:800, color:'#ff4646', margin:'0 0 16px' }}>Final Confirmation</h2>
            <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:16, lineHeight:1.5 }}>
              Type <strong>DELETE</strong> below to permanently erase your account. This action cannot be reversed.
            </p>
            <input
              className="input"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              style={{ width:'100%', marginBottom: 20, textAlign:'center', fontWeight:'bold' }}
            />
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => setShowDeleteConfirmModal(false)} className="btn btn-ghost" style={{ flex:1, padding:'12px', borderRadius:12 }}>Go Back</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
                style={{
                  flex:1, padding:'12px', borderRadius:12,
                  background: deleteConfirm.trim().toUpperCase() === 'DELETE' ? '#ff4646' : 'var(--surface2)',
                  color: deleteConfirm.trim().toUpperCase() === 'DELETE' ? '#fff' : 'var(--text-faint)',
                  border:'none', fontWeight: 700, cursor: (deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE') ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const styles = {
  toggle: (theme) => ({
    width: 48, height: 26,
    background: theme === 'dark'
      ? 'linear-gradient(135deg, #00C8FF, #7B5CF0)'
      : 'var(--surface3)',
    borderRadius: 99,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.25s ease',
    flexShrink: 0,
  }),
  toggleKnob: (theme) => ({
    position: 'absolute',
    top: 3, left: theme === 'dark' ? 25 : 3,
    width: 20, height: 20,
    background: '#fff',
    borderRadius: '50%',
    transition: 'left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  }),
}
