import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { api } from '../api'
import { usePersistentState } from '../hooks/usePersistentState'
import { drawCameraFrame } from '../utils/cameraDraw'

/* ── useIsMobile ── */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

/* ─────────────── shared helpers ─────────────── */
const fmtTime = (s) => {
  if (!isFinite(s) || isNaN(s)) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ds = Math.round((s % 1) * 10)
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${ds}`
}

/* ─────────────── state machine ─────────────── */
const initialState = {
  phase: 'IDLE', // IDLE | PREPARING_CAMERA | COUNTDOWN | RECORDING | PROCESSING | READY_TO_EDIT | EXPORTING | ERROR
  countdown: 3,
  elapsed: 0,
  cameraErr: '',
  outputBlob: null,
  outputUrl: null,
  outputExt: 'webm',
  trimStart: 0,
  trimEnd: 0,
  duration: 0,
  thumbnails: []
}

function recorderReducer(state, action) {
  switch(action.type) {
    case 'START_CAMERA': return { ...state, phase: 'PREPARING_CAMERA', cameraErr: '' }
    case 'CAMERA_READY': return { ...state, phase: 'IDLE' }
    case 'CAMERA_ERROR': return { ...state, phase: 'ERROR', cameraErr: action.payload }
    case 'START_COUNTDOWN': return { ...state, phase: 'COUNTDOWN', countdown: 3, elapsed: 0 }
    case 'TICK_COUNTDOWN': return { ...state, countdown: action.payload }
    case 'START_RECORDING': return { ...state, phase: 'RECORDING', elapsed: 0 }
    case 'TICK_ELAPSED': return { ...state, elapsed: state.elapsed + 1 }
    case 'STOP_RECORDING': return { ...state, phase: 'PROCESSING' }
    case 'PROCESSING_DONE': 
      return { 
        ...state, 
        phase: 'READY_TO_EDIT',
        outputBlob: action.payload.blob,
        outputUrl: action.payload.url,
        duration: action.payload.duration,
        trimStart: 0,
        trimEnd: action.payload.duration,
        thumbnails: action.payload.thumbnails
      }
    case 'SET_THUMBNAILS':
      return { ...state, thumbnails: action.payload }
    case 'SET_TRIM':
      return { ...state, trimStart: action.payload.start, trimEnd: action.payload.end }
    // UPDATE_TRIM — used by TrimBar; updates just one side
    case 'UPDATE_TRIM':
      return {
        ...state,
        trimStart: action.payload.start !== undefined ? action.payload.start : state.trimStart,
        trimEnd:   action.payload.end   !== undefined ? action.payload.end   : state.trimEnd,
      }
    case 'START_EXPORT': return { ...state, phase: 'EXPORTING' }
    case 'EXPORT_DONE':  // fall-through
    case 'FINISH_EXPORT': return { ...state, phase: 'READY_TO_EDIT' }
    case 'RESET': 
      if (state.outputUrl) {
        URL.revokeObjectURL(state.outputUrl)
      }
      return { ...initialState, phase: 'IDLE' }
    default: return state
  }
}

async function generateThumbnails(blob, duration, count = 14) {
  if (!blob || duration <= 0 || !isFinite(duration)) return []
  const vid = document.createElement('video')
  vid.muted = true
  vid.preload = 'auto'
  const url = URL.createObjectURL(blob)
  vid.src = url
  await new Promise(r => vid.addEventListener('loadedmetadata', r, { once: true }))
  
  const cvs = document.createElement('canvas')
  cvs.width = 120; cvs.height = 68
  const ctx = cvs.getContext('2d')
  const out = []
  
  for (let i = 0; i < count; i++) {
    vid.currentTime = (duration * i) / Math.max(count - 1, 1)
    await new Promise(r => vid.addEventListener('seeked', r, { once: true }))
    // Cover-crop into the thumb so portrait (9:16) videos aren't squashed
    const vw = vid.videoWidth || 120, vh = vid.videoHeight || 68
    const scale = Math.max(120 / vw, 68 / vh)
    const dw = vw * scale, dh = vh * scale
    ctx.drawImage(vid, (120 - dw) / 2, (68 - dh) / 2, dw, dh)
    out.push(cvs.toDataURL('image/jpeg', 0.6))
  }
  URL.revokeObjectURL(url)
  return out
}

/* ─────────────── TrimBar ─────────────── */
function TrimBar({ thumbs, totalSecs, trimStart, trimEnd, onTrimChange, onSeek, isMobile }) {
  // Thumbnails are now pre-generated in the PROCESSING phase
  const [localStart, setLocalStart] = useState(trimStart)
  const [localEnd,   setLocalEnd]   = useState(trimEnd)
  const stripRef     = useRef(null)
  const startHRef    = useRef(null)
  const endHRef      = useRef(null)
  const leftDarkRef  = useRef(null)
  const rightDarkRef = useRef(null)
  const borderRef    = useRef(null)
  const dragRef      = useRef(null)
  const seekRafRef   = useRef(null)
  const lastSeekRef  = useRef(0)
  const startTextRef = useRef(null)
  const endTextRef   = useRef(null)
  const selectedTextRef = useRef(null)
  const N = 14

  // Sync from parent when not actively dragging
  useEffect(() => {
    if (!dragRef.current) {
      setLocalStart(trimStart)
      setLocalEnd(trimEnd)
    }
  }, [trimStart, trimEnd])

  const total = totalSecs > 0 ? totalSecs : 1
  // Use local state for rendering during drag for smooth 60fps visuals
  const pctS  = Math.max(0, Math.min(100, (localStart / total) * 100))
  const pctE  = Math.max(0, Math.min(100, (localEnd   / total) * 100))

  const startDrag = (which, ev) => {
    ev.preventDefault()
    dragRef.current = which
    
    // Mutable vars for the drag closure — avoids stale state reads
    let currentStart = localStart
    let currentEnd   = localEnd

    const onMove = (e) => {
      if (e.cancelable) {
        e.preventDefault() // Block page scroll completely while dragging handles
      }
      
      const cx   = e.touches ? e.touches[0].clientX : e.clientX
      const rect = stripRef.current?.getBoundingClientRect()
      if (!rect) return
      const pct  = Math.max(0, Math.min(1, (cx - rect.left) / rect.width))
      const secs = Math.round(pct * total * 10) / 10
      
      let targetTime = secs
      if (which === 'start') {
        currentStart = Math.min(secs, currentEnd - 0.3)
        targetTime = currentStart
        
        // Direct DOM mutations for butter-smooth 60fps performance on mobile
        const nextPctS = (currentStart / total) * 100
        const nextPctE = (currentEnd / total) * 100
        if (startHRef.current) startHRef.current.style.left = `${nextPctS}%`
        if (leftDarkRef.current) leftDarkRef.current.style.width = `${nextPctS}%`
        if (borderRef.current) {
          borderRef.current.style.left = `${nextPctS}%`
          borderRef.current.style.width = `${nextPctE - nextPctS}%`
        }
        if (startTextRef.current) startTextRef.current.innerText = fmtTime(currentStart)
        if (selectedTextRef.current) selectedTextRef.current.innerText = `✂️ ${fmtTime(currentEnd - currentStart)} selected`
      } else {
        currentEnd = Math.max(secs, currentStart + 0.3)
        targetTime = currentEnd

        // Direct DOM mutations for butter-smooth 60fps performance on mobile
        const nextPctS = (currentStart / total) * 100
        const nextPctE = (currentEnd / total) * 100
        if (endHRef.current) endHRef.current.style.left = `${nextPctE}%`
        if (rightDarkRef.current) rightDarkRef.current.style.width = `${100 - nextPctE}%`
        if (borderRef.current) {
          borderRef.current.style.width = `${nextPctE - nextPctS}%`
        }
        if (endTextRef.current) endTextRef.current.innerText = fmtTime(currentEnd)
        if (selectedTextRef.current) selectedTextRef.current.innerText = `✂️ ${fmtTime(currentEnd - currentStart)} selected`
      }

      // Throttled video seek — stable 40ms seek window for phone decoders
      const now = performance.now()
      if (now - lastSeekRef.current > 40) {
        lastSeekRef.current = now
        if (seekRafRef.current) cancelAnimationFrame(seekRafRef.current)
        seekRafRef.current = requestAnimationFrame(() => {
          onSeek?.(targetTime)
        })
      }
    }

    const onUp = () => {
      dragRef.current = null
      // Sync local React state with final drag values
      setLocalStart(currentStart)
      setLocalEnd(currentEnd)
      onTrimChange(which, which === 'start' ? currentStart : currentEnd)
      
      document.removeEventListener('mousemove',  onMove)
      document.removeEventListener('mouseup',    onUp)
      document.removeEventListener('touchmove',  onMove)
      document.removeEventListener('touchend',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend',  onUp)
  }

  const Handle = ({ side, innerRef }) => {
    const isPct = side === 'start' ? pctS : pctE
    return (
      // Outer div is the 44px touch target (Apple HIG minimum)
      <div
        ref={innerRef}
        onMouseDown={e => startDrag(side, e)}
        onTouchStart={e => startDrag(side, e)}
        style={{
          position: 'absolute', left: `${isPct}%`, top: 0, bottom: 0,
          width: 44, transform: 'translateX(-50%)',
          cursor: 'ew-resize', zIndex: 6,
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
          touchAction: 'none',
        }}
      >
        {/* Inner visual handle — 22px wide, centered inside the 44px touch zone */}
        <div style={{
          width: 22,
          background: '#E1306C',
          borderRadius: side === 'start' ? '6px 0 0 6px' : '0 6px 6px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(225,48,108,0.5)',
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 2, height: 14, borderRadius: 2,
              background: 'rgba(255,255,255,0.9)',
              margin: '0 1px',
            }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Strip wrapper adds horizontal overflow padding so 44px handles don't get clipped */}
      <div style={{ padding: '0 22px', margin: '0 -22px', position: 'relative', touchAction: 'none' }}>
      <div ref={stripRef} style={{
        position: 'relative',
        height: isMobile ? 88 : 76,
        width: '100%',
        // overflow must be VISIBLE so the 44px handle touch zones aren't clipped
        overflow: 'visible',
        borderRadius: 10,
        background: '#0a0a0a', cursor: 'default',
        touchAction: 'none',
        // clip the thumbnails only, not the handles
        isolation: 'isolate',
      }}>
        {/* Thumbnail frames */}
        <div style={{ display: 'flex', height: '100%', gap: 1 }}>
          {thumbs.length > 0
            ? thumbs.map((url, i) => (
                <img key={i} src={url} alt=""
                  style={{ flex: 1, height: '100%', objectFit: 'cover', minWidth: 0, display: 'block' }}
                />
              ))
            : Array.from({ length: N }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: '100%',
                  background: `hsl(0,0%,${10 + (i % 2) * 5}%)`,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))
          }
        </div>
        {/* Left dark region */}
        <div ref={leftDarkRef} style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pctS}%`, background: 'rgba(0,0,0,0.68)',
          pointerEvents: 'none',
        }} />
        {/* Right dark region */}
        <div ref={rightDarkRef} style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: `${100 - pctE}%`, background: 'rgba(0,0,0,0.68)',
          pointerEvents: 'none',
        }} />
        {/* Selection border */}
        <div ref={borderRef} style={{
          position: 'absolute', pointerEvents: 'none',
          left: `${pctS}%`, width: `${pctE - pctS}%`,
          top: 0, bottom: 0,
          border: '3px solid #E1306C',
          boxSizing: 'border-box',
        }} />
        {/* Handles */}
        <Handle side="start" innerRef={startHRef} />
        <Handle side="end" innerRef={endHRef} />
      </div>
      </div>  {/* end strip wrapper */}

      {/* Time labels — use localStart/localEnd for live drag feedback */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</div>
          <div ref={startTextRef} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(localStart)}</div>
        </div>
        <div ref={selectedTextRef} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ✂️ {fmtTime(localEnd - localStart)} selected
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</div>
          <div ref={endTextRef} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(localEnd)}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 2 }}>
        Drag the pink handles · Total: {fmtTime(totalSecs)}
      </div>
    </div>
  )
}

/* ─────────────── flip-camera icon (front/back arrows) ─────────────── */
const FlipIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 8a8 8 0 0 0-14.9-2.5" />
    <polyline points="5 2 5 6 9 6" />
    <path d="M4 16a8 8 0 0 0 14.9 2.5" />
    <polyline points="19 22 19 18 15 18" />
  </svg>
)

/* ─────────────── Instagram-style filter carousel ───────────────
   Horizontal, center-snapping: the circle in the middle is the active filter,
   neighbours peek in from the sides. Swipe to change, tap a circle to jump. */
function FilterCarousel({ index, onChange }) {
  const ref = useRef(null)
  const ITEM = 60 // 48px circle + 12px gap
  const settleTimer = useRef(null)

  // Position the carousel on the active filter when it mounts
  useEffect(() => {
    ref.current?.scrollTo({ left: index * ITEM })
  }, []) // eslint-disable-line

  const handleScroll = () => {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(FILTERS.length - 1, Math.round(el.scrollLeft / ITEM)))
      onChange(i)
    }, 90)
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: '0.72rem',
        letterSpacing: '0.04em', textShadow: '0 1px 5px rgba(0,0,0,0.8)', marginBottom: 7,
      }}>
        {FILTERS[index].name}
      </div>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="hide-scroll"
        style={{
          display: 'flex', gap: 12, overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '5px calc(50% - 24px)',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {FILTERS.map((f, i) => (
          <button
            key={i}
            onClick={() => ref.current?.scrollTo({ left: i * ITEM, behavior: 'smooth' })}
            aria-label={f.name}
            style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              scrollSnapAlign: 'center', background: f.swatch,
              border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: i === index ? '0 0 0 3px #fff, 0 2px 12px rgba(0,0,0,0.45)' : '0 0 0 1px rgba(255,255,255,0.35)',
              transform: i === index ? 'scale(1.14)' : 'scale(0.88)',
              opacity: i === index ? 1 : 0.72,
              transition: 'transform 0.16s, opacity 0.16s, box-shadow 0.16s',
            }}
          >
            <span style={{ fontSize: '1.05rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))' }}>{f.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────── constants ─────────────────── */
const SPEEDS = [
  { label: '1',  value: 12 },
  { label: '2',  value: 22 },
  { label: '3',  value: 35 },
  { label: '4',  value: 50 },
  { label: '5',  value: 70 },
  { label: '6',  value: 100 },
  { label: '7',  value: 140 },
]
const FONT_SIZES = [
  { label: 'S',  value: 22 },
  { label: 'M',  value: 30 },
  { label: 'L',  value: 40 },
  { label: 'XL', value: 52 },
]

/* ─────────────────── cinematic filters ─────────────────── */
// Researched from CapCut, TikTok, Instagram Reels, and Prequel
const FILTERS = [
  {
    name: 'None',
    emoji: '⬜',
    css: 'none',
    swatch: 'linear-gradient(135deg, #888, #ccc)',
    desc: 'Raw camera, no filter',
  },
  {
    name: 'Cinematic',
    emoji: '🎬',
    css: 'contrast(112%) brightness(88%) saturate(78%)',
    swatch: 'linear-gradient(135deg, #1a1a2e, #4a4a6a)',
    desc: 'Hollywood film look, crushed blacks',
  },
  {
    name: 'Golden Hour',
    emoji: '🌅',
    css: 'brightness(108%) saturate(135%) sepia(22%) hue-rotate(-12deg)',
    swatch: 'linear-gradient(135deg, #f7971e, #ffd200)',
    desc: 'Warm sunset glow, lifestyle content',
  },
  {
    name: 'Studio',
    emoji: '💡',
    css: 'brightness(118%) contrast(105%) saturate(110%)',
    swatch: 'linear-gradient(135deg, #f8f8ff, #e0e8ff)',
    desc: 'Clean professional studio lighting',
  },
  {
    name: 'Aura',
    emoji: '🧘',
    css: 'brightness(115%) saturate(125%) contrast(95%) hue-rotate(-8deg)',
    swatch: 'linear-gradient(135deg, #fbc2eb, #a6c1ee)',
    desc: 'Dreamy elegant glow, skin-enhancing warmth',
  },
  {
    name: 'Vintage',
    emoji: '📽️',
    css: 'sepia(35%) contrast(92%) brightness(106%) saturate(88%)',
    swatch: 'linear-gradient(135deg, #b8860b, #d4a960)',
    desc: 'Retro film grain feel, nostalgic',
  },
  {
    name: 'Soft Glow',
    emoji: '✨',
    css: 'brightness(112%) contrast(92%) saturate(118%)',
    swatch: 'linear-gradient(135deg, #f8cdda, #1d2b64)',
    desc: 'Beauty/lifestyle, skin-flattering',
  },
  {
    name: 'B&W Drama',
    emoji: '🎭',
    css: 'grayscale(100%) contrast(120%) brightness(90%)',
    swatch: 'linear-gradient(135deg, #000, #fff)',
    desc: 'Bold black and white, high contrast',
  },
]

/* ─────────────────── canvas overlay helper ─────────────────── */
function drawHookCard(ctx, text, W, H) {
  const maxW = Math.round(W * 0.7)
  const fontSize = 28
  ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`
  ctx.textAlign = 'center'

  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  const lineH = fontSize * 1.38
  const totalH = lines.length * lineH
  const padX = 28, padY = 16
  const boxW = Math.max(Math.min(W - 80, maxW + padX * 2), 320)
  const boxH = totalH + padY * 2
  const boxX = (W - boxW) / 2
  const boxY = H - 100 - boxH

  // Shadow effect
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 6

  // Draw gradient box (Saffron to Magenta: #FF8C00 to #FF2D6F)
  const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH)
  grad.addColorStop(0, 'rgba(255, 140, 0, 0.92)')
  grad.addColorStop(1, 'rgba(255, 45, 111, 0.92)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 16)
  ctx.fill()

  // Reset shadow for text drawing
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Draw text lines
  ctx.fillStyle = '#ffffff'
  lines.forEach((ln, idx) => {
    const y = boxY + padY + idx * lineH + fontSize * 0.88
    ctx.fillText(ln, W / 2, y)
  })
}

/* ─────────────────── component ─────────────────── */
export default function Record() {
  const navigate = useNavigate()
  // script
  const [script,     setScript]     = usePersistentState('rc_script', '')
  const [editing,    setEditing]    = usePersistentState('rc_editing', false)

  // settings
  const [speedIdx,   setSpeedIdx]   = useState(2)   // default speed 3
  const [fontIdx,    setFontIdx]    = useState(1)    // M
  const [mirror,     setMirror]     = useState(true) // front cam default mirrored
  const [facingMode, setFacingMode] = useState('user')
  const [filterIdx,  setFilterIdx]  = useState(0)   // 0 = None
  const prevFilter = () => setFilterIdx(i => (i - 1 + FILTERS.length) % FILTERS.length)
  const nextFilter = () => setFilterIdx(i => (i + 1) % FILTERS.length)
  const [showGrid,     setShowGrid]     = useState(false)
  const [scrollPaused, setScrollPaused] = useState(false) // teleprompter pause — UI mirror of scrollingRef

  // steps & recording handled by central state machine
  const [state, dispatch] = useReducer(recorderReducer, initialState)
  const { phase, countdown, elapsed, cameraErr, outputBlob, outputUrl, outputExt, trimStart, trimEnd, duration, thumbnails } = state

  const isMobile = useIsMobile()

  // production overlay metadata
  const [availableSongs] = useState(() => {
    try {
      const stored = localStorage.getItem('rc_songs')
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [selectedSong, setSelectedSong] = useState(() => {
    try {
      const stored = localStorage.getItem('rc_songs')
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? (parsed.find(s => s.previewUrl) || null) : null
    } catch {
      return null
    }
  })
  const [mixMusic, setMixMusic] = useState(!!selectedSong)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [isPlayingDone, setIsPlayingDone] = useState(false)
  const [vidTime, setVidTime] = useState(0)
  // Visual direction / hook-overlay were removed from the recorder (user request):
  // the teleprompter shows only the spoken script. Keeping the states empty makes
  // all the overlay UI below render nothing.
  const [textOverlay] = useState('')
  const [burnOverlay, setBurnOverlay] = useState(true)
  const [visualDirection] = useState(null)

  // refs
  const bgMusicRef    = useRef(null)
  const videoRef      = useRef(null)   // camera preview (visible)
  const hiddenVideoRef = useRef(null)   // off-screen video used as canvas draw source
  const streamRef     = useRef(null)
  const streamDimsRef = useRef({ w: 1280, h: 720 }) // actual camera resolution (updated on getUserMedia)
  const outputDimsRef = useRef({ w: 1080, h: 1920 }) // recorded canvas dims (fixed 9:16 on portrait screens)
  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const scrollRef     = useRef(null)   // teleprompter text container
  const scrollPosRef  = useRef(0)
  const scrollingRef  = useRef(true)   // live scroll state — read by RAF without stale closure
  const speedRef      = useRef(SPEEDS[2].value) // live speed value — read by RAF without stale closure
  const rafRef        = useRef(null)
  const timerRef      = useRef(null)
  const countdownRef  = useRef(null)
  const canvasLoopRef = useRef(false)
  const doneVideoRef  = useRef(null)
  const elapsedRef    = useRef(0)       // mirror of elapsed for use inside callbacks
  const framesDrawnRef = useRef(0)
  const recordedFpsRef = useRef(30)
  const previewCanvasRef = useRef(null) // canvas for camera preview (handles landscape→portrait conversion)
  const previewRafRef    = useRef(null) // RAF handle for canvas preview loop

  // Keep speedRef in sync with speedIdx state
  useEffect(() => { speedRef.current = SPEEDS[speedIdx].value }, [speedIdx])

  // Live refs so the recording draw-loop reads the latest filter/mirror without a
  // stale closure — lets users switch filters (and mirror) live while recording.
  const filterRef = useRef(FILTERS[0].css)
  const mirrorRef = useRef(mirror)
  useEffect(() => { filterRef.current = FILTERS[filterIdx].css }, [filterIdx])
  useEffect(() => { mirrorRef.current = mirror }, [mirror])

  /* ── start camera ── */
  const startCamera = useCallback(async (facing = facingMode) => {
    dispatch({ type: 'START_CAMERA' })
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      
      // Simple portrait dimensions — canvas preview handles the display correctly
      const isPortraitDevice = typeof window !== 'undefined' && window.innerWidth < 768
      const res = isPortraitDevice
        ? { width: { ideal: 1080 }, height: { ideal: 1920 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } }
      const audioReq = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: facing }, ...res, frameRate: { ideal: 30 } },
          audio: audioReq,
        })
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, ...res, frameRate: { ideal: 30 } },
          audio: audioReq,
        })
      }

      streamRef.current = stream
      // Capture actual video dimensions for correct canvas sizing during recording/export
      const vt = stream.getVideoTracks()[0]
      if (vt) {
        const s = vt.getSettings()
        if (s.width && s.height) streamDimsRef.current = { w: s.width, h: s.height }
      }
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      // Keep the hidden video in sync too — this is our stable canvas draw source
      if (hiddenVideoRef.current) { hiddenVideoRef.current.srcObject = stream; hiddenVideoRef.current.play().catch(() => {}) }
      dispatch({ type: 'CAMERA_READY' })
    } catch (e) {
      dispatch({ type: 'CAMERA_ERROR', payload: e.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera in your browser settings.'
        : 'Could not access camera: ' + e.message })
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
      clearInterval(timerRef.current)
      clearInterval(countdownRef.current)
      canvasLoopRef.current = false
      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
      }
    }
  }, []) // eslint-disable-line

  /* ── Canvas-based camera preview — mobile only ──
     Draws through the SAME drawCameraFrame routine the recorder uses, so the
     preview always matches the recorded output (orientation, crop, filter).
     Runs in setup AND countdown/recording phases. */
  useEffect(() => {
    if (!isMobile) return
    const livePhases = ['IDLE', 'PREPARING_CAMERA', 'ERROR', 'COUNTDOWN', 'RECORDING']
    if (!livePhases.includes(phase)) {
      cancelAnimationFrame(previewRafRef.current)
      return
    }

    let active = true

    const draw = () => {
      if (!active) return
      const src = hiddenVideoRef.current  // always-on stream source
      const canvas = previewCanvasRef.current
      previewRafRef.current = requestAnimationFrame(draw)
      if (!canvas || !src || !src.videoWidth || !src.videoHeight) return
      drawCameraFrame(canvas.getContext('2d'), src, canvas.width, canvas.height, {
        mirror,
        filter: FILTERS[filterIdx].css,
      })
    }

    previewRafRef.current = requestAnimationFrame(draw)
    return () => {
      active = false
      cancelAnimationFrame(previewRafRef.current)
    }
  }, [isMobile, phase, mirror, filterIdx])

  /* ── toggle preview music ── */
  const togglePreviewMusic = () => {
    if (!bgMusicRef.current) return
    if (isPlayingPreview) {
      bgMusicRef.current.pause()
      setIsPlayingPreview(false)
    } else {
      bgMusicRef.current.play().catch(e => console.warn('Preview block:', e))
      setIsPlayingPreview(true)
    }
  }

  /* ── flip camera (front/back) ── */
  // While RECORDING we swap ONLY the video track: a full startCamera() would stop
  // the audio track the MediaRecorder is using and silence the rest of the take.
  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'

    if (phase === 'RECORDING') {
      try {
        const isPortraitDevice = typeof window !== 'undefined' && window.innerWidth < 768
        const res = isPortraitDevice
          ? { width: { ideal: 1080 }, height: { ideal: 1920 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } }
        let vidStream
        try {
          vidStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next }, ...res }, audio: false })
        } catch {
          vidStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next, ...res }, audio: false })
        }
        const audioTracks = streamRef.current ? streamRef.current.getAudioTracks() : []
        if (streamRef.current) streamRef.current.getVideoTracks().forEach(t => t.stop())
        const merged = new MediaStream([...vidStream.getVideoTracks(), ...audioTracks])
        streamRef.current = merged
        if (videoRef.current) { videoRef.current.srcObject = merged; videoRef.current.play().catch(() => {}) }
        if (hiddenVideoRef.current) { hiddenVideoRef.current.srcObject = merged; hiddenVideoRef.current.play().catch(() => {}) }
        setFacingMode(next)
        setMirror(next === 'user')
      } catch (e) {
        console.warn('Live camera flip failed:', e)
      }
      return
    }

    setFacingMode(next)
    setMirror(next === 'user')
    await startCamera(next)
  }

  /* ── auto-scroll teleprompter ── */
  // The rAF loop reads scrollingRef (kept in sync below) instead of capturing
  // the `scrolling` state — a captured value goes stale after pause/resume and
  // silently stops the scroll.
  const startScroll = useCallback(() => {
    // Uses refs (scrollingRef, speedRef) so the loop never has stale closure values.
    // No need to restart on speed change or pause/resume — ref values are always live.
    let last = null
    const tick = (ts) => {
      if (!scrollRef.current) return
      if (last !== null && scrollingRef.current) {
        const delta = ((ts - last) / 1000) * speedRef.current
        scrollPosRef.current += delta
        scrollRef.current.scrollTop = scrollPosRef.current
      }
      last = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, []) // no deps — all values come from stable refs

  const stopScroll = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  /* ── begin: countdown → record ── */
  const beginRecording = () => {
    if (!streamRef.current) return
    dispatch({ type: 'START_COUNTDOWN' })
    scrollPosRef.current = 0
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    
    // Reset scrolling state for the new recording session
    scrollingRef.current = true
    setScrollPaused(false)

    let n = 3
    countdownRef.current = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(countdownRef.current)
        launchRecording()
      } else {
        dispatch({ type: 'TICK_COUNTDOWN', payload: n })
      }
    }, 1000)
  }

  const launchRecording = () => {
    const stream = streamRef.current
    if (!stream) return

    // Ensure the off-screen video source is actually playing (it may have been paused by the browser)
    if (hiddenVideoRef.current && hiddenVideoRef.current.paused) {
      hiddenVideoRef.current.play().catch(() => {})
    }

    // ── Fixed-orientation output canvas (the Instagram approach) ──
    // Phone sensors often deliver a LANDSCAPE stream even when the phone is held
    // upright, and iOS/Android differ per device — trusting the sensor dims is why
    // recordings came out horizontal (or looked zoomed). Instead: on a portrait
    // screen ALWAYS compose onto a vertical 9:16 canvas and center-crop the camera
    // into it (same "cover" crop the on-screen preview shows, so WYSIWYG).
    const srcEl0 = hiddenVideoRef.current
    const sw0 = (srcEl0 && srcEl0.videoWidth)  || streamDimsRef.current.w
    const sh0 = (srcEl0 && srcEl0.videoHeight) || streamDimsRef.current.h
    const portraitUI = window.innerHeight > window.innerWidth
    let CW, CH
    if (portraitUI) {
      // Vertical 9:16, sized from the source so we never upscale a weak camera too far
      const srcLong = Math.max(sw0, sh0)
      CH = Math.min(1920, Math.max(1280, srcLong)); CH -= CH % 2
      CW = Math.round(CH * 9 / 16); CW -= CW % 2
    } else {
      // Desktop / landscape: keep the camera's native dims
      CW = sw0 - (sw0 % 2)
      CH = sh0 - (sh0 % 2)
    }
    const canvas = document.createElement('canvas')
    canvas.width  = CW
    canvas.height = CH
    outputDimsRef.current = { w: CW, h: CH }
    const ctx = canvas.getContext('2d')

    // Draw loop — applies CSS filter + mirror to every frame
    canvasLoopRef.current = true
    framesDrawnRef.current = 0
    const drawFrame = () => {
      if (!canvasLoopRef.current) return
      framesDrawnRef.current++
      // Draw the camera through the SAME routine as the on-screen preview —
      // including the sideways-landscape rotation. This was THE horizontal-video
      // bug: the preview rotated the frame upright but the recorder didn't.
      // Live refs so filter/mirror can change mid-record; dims re-read per frame
      // so a mid-record camera flip stays correct.
      const src = hiddenVideoRef.current
      if (src && src.readyState >= 2 && !src.paused) {
        drawCameraFrame(ctx, src, CW, CH, { mirror: mirrorRef.current, filter: filterRef.current })
      } else {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, CW, CH)
      }
      
      // Draw Hook Card overlay if enabled, exists, and within first 4 seconds
      if (burnOverlay && textOverlay && elapsedRef.current < 4) {
        drawHookCard(ctx, textOverlay, canvas.width, canvas.height)
      }

      requestAnimationFrame(drawFrame)
    }
    requestAnimationFrame(drawFrame)

    // Capture the canvas as a stream and mix in the microphone audio
    // Use 60fps capture to match high-refresh displays and smoother motion
    const canvasStream = canvas.captureStream(60)
    const audioTrack   = stream.getAudioTracks()[0]
    const tracks = [...canvasStream.getVideoTracks()]

    let finalAudioTrack = audioTrack
    let audioCtx = null
    if (mixMusic && selectedSong && selectedSong.previewUrl && audioTrack) {
      try {
        if (bgMusicRef.current) {
          bgMusicRef.current.pause()
          setIsPlayingPreview(false)
          bgMusicRef.current.currentTime = 0
        }

        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const destNode = audioCtx.createMediaStreamDestination()

        const micSource = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]))
        micSource.connect(destNode)

        if (bgMusicRef.current) {
          const bgMusicNode = audioCtx.createMediaElementSource(bgMusicRef.current)
          const bgGain = audioCtx.createGain()
          bgGain.gain.value = 0.12

          bgMusicNode.connect(bgGain)
          bgGain.connect(destNode)
          bgGain.connect(audioCtx.destination) // Routes backing music into headphones/earbuds for monitoring

          bgMusicRef.current.play().catch(e => console.warn('Record music play failed:', e))
        }

        finalAudioTrack = destNode.stream.getAudioTracks()[0]
      } catch (err) {
        console.warn('Web Audio mixing failed, falling back to mic-only:', err)
      }
    }

    if (finalAudioTrack) tracks.push(finalAudioTrack)
    const combinedStream = new MediaStream(tracks)

    // Pick the best available MIME type. Includes mp4 for iOS Safari, which
    // supports none of the webm types — forcing webm there makes the
    // MediaRecorder constructor THROW and recording silently never starts.
    const MIMES = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ]
    const mime = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || ''
    console.log('[Recorder] launchRecording: Picked MIME type', mime || '(browser default)')

    chunksRef.current = []
    const recOpts = { videoBitsPerSecond: 8_000_000 } // 8 Mbps — high quality for social sharing
    if (mime) recOpts.mimeType = mime
    const rec = new MediaRecorder(combinedStream, recOpts)
    recorderRef.current = rec

    rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }

    rec.onstop = () => {
      canvasLoopRef.current = false

      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
        bgMusicRef.current.currentTime = 0
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {})
      }

      const rawBlob = new Blob(chunksRef.current, { type: mime })
      const capturedElapsed = elapsedRef.current
      
      // Calculate actual captured framerate dynamically (capped between 24 and 60)
      const actualFps = capturedElapsed > 0 ? Math.round(framesDrawnRef.current / capturedElapsed) : 30
      recordedFpsRef.current = Math.min(60, Math.max(24, actualFps)) || 30

      console.log(`[Recorder] Recording stopped. Blob finalized: ${rawBlob.size} bytes. Captured elapsed: ${capturedElapsed}s at ~${recordedFpsRef.current} fps`)

      // If blob is completely empty, show error immediately (happens if camera was blocked mid-recording)
      if (rawBlob.size === 0) {
        dispatch({ type: 'CAMERA_ERROR', payload: 'Recording failed: no data captured. Please check camera permissions and try again.' })
        return
      }

      // Transition to edit phase instantly to avoid waiting on mobile/desktop
      const url = URL.createObjectURL(rawBlob)
      const dur = capturedElapsed || 1

      console.log(`[Recorder] Processing done. Phase transitioning to READY_TO_EDIT`)
      dispatch({ 
        type: 'PROCESSING_DONE', 
        payload: { blob: rawBlob, url, duration: dur, thumbnails: [] } 
      })
      
      stopScroll()
      clearInterval(timerRef.current)

      // Ping streak when recording finishes
      api.pingStreak().catch(console.error)

      // Generate thumbnails asynchronously in background
      generateThumbnails(rawBlob, dur, isMobile ? 6 : 12).then(thumbs => {
        dispatch({ type: 'SET_THUMBNAILS', payload: thumbs })
      }).catch(err => {
        console.warn('Background thumbnail generation failed:', err)
      })
    }

    rec.start(200) // chunk every 200ms for more reliable data
    console.log('[Recorder] Recording started')
    elapsedRef.current = 0
    dispatch({ type: 'START_RECORDING' })
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      dispatch({ type: 'TICK_ELAPSED' })
    }, 1000)
    // Scroll is started by the useEffect that watches phase === 'RECORDING',
    // guaranteeing the scrollRef DOM node exists before the RAF loop begins.
  }

  const stopRecording = () => {
    canvasLoopRef.current = false
    clearInterval(timerRef.current)
    stopScroll()
    dispatch({ type: 'STOP_RECORDING' })
    const rec = recorderRef.current
    if (!rec) return
    // Flush any buffered data before stopping so the last chunk isn't lost
    if (rec.state === 'recording') {
      try { rec.requestData() } catch (_) {}
    }
    try { rec.stop() } catch (err) {
      console.error('stopRecording error:', err)
      dispatch({ type: 'CAMERA_ERROR', payload: 'Processing failed.' })
    }
  }

  const toggleScrollPause = () => {
    scrollingRef.current = !scrollingRef.current
    setScrollPaused(!scrollingRef.current)
  }

  /* ── right-edge control rail (Instagram-style vertical icon stack) ── */
  const renderRail = (items) => (
    <div style={S.rail}>
      {items.map((it, i) => it.stepper ? (
        <div key={i} style={S.railItem}>
          <div style={S.railStack}>
            <button style={S.railStackBtn} onClick={it.up} aria-label={`${it.cap} up`}>˄</button>
            <div style={S.railStackVal}>{it.value}</div>
            <button style={S.railStackBtn} onClick={it.down} aria-label={`${it.cap} down`}>˅</button>
          </div>
          <span style={S.railCap}>{it.cap}</span>
        </div>
      ) : (
        <button key={i} style={S.railItem} onClick={it.onClick} aria-label={it.cap}>
          <div style={{ ...S.railCircle, ...(it.active ? S.railCircleOn : {}) }}>{it.icon}</div>
          <span style={S.railCap}>{it.cap}</span>
        </button>
      ))}
    </div>
  )

  /* ── speed change ── no scroll restart needed; speedRef is always current */
  // (speedRef synced via useEffect above)

  /* ── re-attach stream whenever a new <video> element mounts (phase change) ── */
  useEffect(() => {
    if ((phase === 'COUNTDOWN' || phase === 'RECORDING') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
    // When RECORDING phase DOM has mounted, kick off the scroll loop reliably.
    // We do this here (not in launchRecording) so the scrollRef div is guaranteed to exist.
    if (phase === 'RECORDING') {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      scrollingRef.current = true
      startScroll()
    }
  }, [phase]) // eslint-disable-line


  const handleDownload = async () => {
    if (!outputBlob || phase === 'EXPORTING') return
    
    dispatch({ type: 'START_EXPORT' })
    try {
      console.log('[Recorder] Export started (converting to MP4)')
      const trimmedBlob = await executeTrim()
      console.log(`[Recorder] Export finished. Trimmed blob size: ${trimmedBlob.size} bytes`)
      const url = URL.createObjectURL(trimmedBlob)
      const a = document.createElement('a')
      a.href = url
      // Extension matches actual blob type generated by the pipeline
      a.download = trimmedBlob.type === 'video/mp4' ? 'nuove-recording.mp4' : 'nuove-recording.webm'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      console.error(e)
    }
    dispatch({ type: 'FINISH_EXPORT' })
  }

  /* ── make blob seekable so slider + duration work in browser & media players ── */
  const makeSeekable = (blob, videoEl) => new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    videoEl.src = url
    videoEl.addEventListener('loadedmetadata', function onMeta() {
      videoEl.removeEventListener('loadedmetadata', onMeta)
      if (videoEl.duration === Infinity || isNaN(videoEl.duration)) {
        // Seek to a very large number to force the browser to scan to end
        videoEl.currentTime = 1e10
        videoEl.addEventListener('timeupdate', function onTime() {
          videoEl.removeEventListener('timeupdate', onTime)
          videoEl.currentTime = 0
          resolve(blob)
        }, { once: true })
      } else {
        resolve(blob)
      }
    })
  })

  /* ── trim video using mp4-muxer and WebCodecs (standards compliant MP4) ── */
  const executeTrimWebCodecs = () => new Promise(async (resolve, reject) => {
    if (!outputBlob) return reject(new Error("No blob"))

    if (typeof VideoEncoder === 'undefined' || typeof MediaStreamTrackProcessor === 'undefined') {
      return reject(new Error('WebCodecs API not supported on this browser.'))
    }

    const srcUrl = URL.createObjectURL(outputBlob)
    const tempVideo = document.createElement('video')
    tempVideo.src = srcUrl
    tempVideo.muted = false
    tempVideo.volume = 1

    await new Promise((r, e) => {
      tempVideo.addEventListener('loadedmetadata', r, { once: true })
      tempVideo.addEventListener('error', e, { once: true })
    })

    const duration = isFinite(tempVideo.duration) ? tempVideo.duration : (trimEnd || elapsed)
    const start = Math.max(0, trimStart)
    const end   = Math.min(duration, trimEnd > 0 && trimEnd < duration ? trimEnd : duration)
    console.log(`[Recorder] Trim applied (WebCodecs): start=${start}s, end=${end}s, totalDuration=${duration}s`)

    // Use actual dimensions from tempVideo, ensuring they are even numbers for the encoder
    const targetW = tempVideo.videoWidth - (tempVideo.videoWidth % 2) || 720
    const targetH = tempVideo.videoHeight - (tempVideo.videoHeight % 2) || 1280
    
    // Adaptive export settings: Preserve original recorded framerate and scale bitrate by resolution
    const fps = recordedFpsRef.current || 30
    // Standard high-quality H.264 formula: width * height * fps * 0.1 bits per pixel
    const targetBitrate = Math.min(targetW * targetH * fps * 0.1, 15_000_000)

    const canvas = document.createElement('canvas')
    canvas.width  = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false })

    let audioCtx = null
    let audioTrack = null
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
      await audioCtx.resume()
      const src = audioCtx.createMediaElementSource(tempVideo)
      const dest = audioCtx.createMediaStreamDestination()
      src.connect(dest)
      audioTrack = dest.stream.getAudioTracks()[0]
    } catch (err) {
      console.warn('Audio routing failed in WebCodecs, continuing without audio:', err)
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: targetW, height: targetH },
      audio: audioTrack ? { codec: 'aac', sampleRate: 44100, numberOfChannels: 1 } : undefined,
      fastStart: 'in-memory'
    })

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => reject(e)
    })
    videoEncoder.configure({
      codec: 'avc1.4d002a', // Main profile, Level 4.2
      width: targetW,
      height: targetH,
      bitrate: targetBitrate,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware'
    })

    let audioEncoder = null
    let audioProcessor = null
    let audioReader = null
    if (audioTrack) {
      let firstAudioTs = null
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          if (firstAudioTs === null) firstAudioTs = chunk.timestamp
          const buf = new ArrayBuffer(chunk.byteLength)
          chunk.copyTo(buf)
          const normalizedChunk = new EncodedAudioChunk({
            type: chunk.type,
            timestamp: Math.max(0, chunk.timestamp - firstAudioTs),
            duration: chunk.duration,
            data: buf
          })
          muxer.addAudioChunk(normalizedChunk, meta)
        },
        error: (e) => reject(e)
      })
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitrate: 128000
      })
      audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack })
      audioReader = audioProcessor.readable.getReader()
      
      const readAudio = async () => {
        try {
          while (true) {
            const { done, value } = await audioReader.read()
            if (done || tempVideo.currentTime >= end || tempVideo.ended) {
              if (value) value.close()
              break
            }
            audioEncoder.encode(value)
            value.close()
          }
        } catch (e) {
          console.warn('Audio read loop ended:', e)
        }
      }
      readAudio()
    }

    tempVideo.currentTime = start
    await new Promise(r => tempVideo.addEventListener('seeked', r, { once: true }))

    let frameCount = 0
    let finished = false

    const finish = async () => {
      if (finished) return
      finished = true
      tempVideo.pause()
      tempVideo.src = '' // Free the object URL binding

      try {
        await videoEncoder.flush()
        videoEncoder.close() // Release WebCodecs memory

        if (audioEncoder) {
          await audioEncoder.flush()
          audioEncoder.close()
        }
        
        muxer.finalize()

        const { buffer } = muxer.target
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
        
        URL.revokeObjectURL(srcUrl)
        if (audioCtx) {
          audioCtx.close().catch(() => {})
        }
        
        // Clean up canvas memory
        canvas.width = 0
        canvas.height = 0
        
        resolve(mp4Blob)
      } catch (err) {
        reject(err)
      }
    }

    const drawLoop = async (now, metadata) => {
      if (finished) return
      if (tempVideo.currentTime >= end || tempVideo.ended) {
        finish()
        return
      }

      const vidRatio = tempVideo.videoWidth / (tempVideo.videoHeight || 1);
      const targetRatio = targetW / targetH;
      let drawW, drawH, drawX, drawY;
      
      if (vidRatio > targetRatio) {
        drawH = targetH; drawW = drawH * vidRatio; drawX = (targetW - drawW) / 2; drawY = 0;
      } else {
        drawW = targetW; drawH = drawW / vidRatio; drawX = 0; drawY = (targetH - drawH) / 2;
      }
      
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(tempVideo, drawX, drawY, drawW, drawH)
      
      // Use exact mediaTime from the source video to prevent lagging/speedups, normalized to start at 0
      const mediaTime = metadata && metadata.mediaTime !== undefined ? metadata.mediaTime : tempVideo.currentTime
      let timestamp = Math.round((mediaTime - start) * 1e6)
      if (timestamp < 0) timestamp = 0
      
      const frame = new VideoFrame(canvas, { timestamp })
      videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 })
      frame.close()
      frameCount++

      tempVideo.requestVideoFrameCallback(drawLoop)
    }

    tempVideo.play().catch(err => {
      reject(new Error("Playback blocked: " + err.message))
    })
    tempVideo.requestVideoFrameCallback(drawLoop)

    setTimeout(() => {
      if (!finished) reject(new Error("Export timed out"))
    }, (end - start + 10) * 1000)
  })

  /* ── fallback: trim video using canvas re-encode (legacy webm) ── */
  const executeTrimFallback = () => new Promise(async (resolve, reject) => {
    if (!outputBlob) return resolve(outputBlob)


    const srcUrl = URL.createObjectURL(outputBlob)
    const tempVideo = document.createElement('video')
    tempVideo.src = srcUrl
    // IMPORTANT: do NOT set volume=0 — the AudioContext needs the element to be unmuted
    // We mute it via the sink instead (the audio goes into the AudioContext, not speakers)
    tempVideo.muted = false
    tempVideo.volume = 1

    await new Promise(r => tempVideo.addEventListener('loadedmetadata', r, { once: true }))
    const duration = isFinite(tempVideo.duration) ? tempVideo.duration : (trimEnd || elapsed)
    const start = Math.max(0, trimStart)
    const end   = Math.min(duration, trimEnd > 0 && trimEnd < duration ? trimEnd : duration)
    console.log(`[Recorder] Trim applied: start=${start}s, end=${end}s, totalDuration=${duration}s`)

    const targetW = tempVideo.videoWidth - (tempVideo.videoWidth % 2) || 720
    const targetH = tempVideo.videoHeight - (tempVideo.videoHeight % 2) || 1280
    const canvas = document.createElement('canvas')
    canvas.width  = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')

    // ── Audio routing via Web Audio API ──
    // AudioContext must be resumed (Chrome suspends it until user gesture; the trim button click is that gesture)
    let audioCtx   = null
    let audioTrack = null
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      await audioCtx.resume()  // critical — without this audio will be silent
      const src  = audioCtx.createMediaElementSource(tempVideo)
      const dest = audioCtx.createMediaStreamDestination()
      src.connect(dest)
      audioTrack = dest.stream.getAudioTracks()[0] || null
    } catch (err) {
      console.warn('Audio routing failed, trimming video-only:', err)
    }

    // ── Build combined stream (canvas video + audio) ──
    const canvasStream = canvas.captureStream(30)
    const tracks = [...canvasStream.getVideoTracks()]
    if (audioTrack) tracks.push(audioTrack)
    const combined = new MediaStream(tracks)

    const MIMES = [
      'video/webm;codecs=vp9,opus', 
      'video/webm;codecs=vp8,opus', 
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4'
    ]
    const mime  = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/mp4' // default to mp4 for iOS
    const rec   = new MediaRecorder(combined, { mimeType: mime })
    const chunks = []
    rec.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data) }

    rec.onstop = () => {
      URL.revokeObjectURL(srcUrl)
      if (audioCtx) audioCtx.close().catch(() => {})
      const raw    = new Blob(chunks, { type: mime })
      const fixVid = document.createElement('video')
      fixVid.muted = true
      const fixUrl = URL.createObjectURL(raw)
      fixVid.src   = fixUrl

      const finish = () => {
        URL.revokeObjectURL(fixUrl)
        resolve(raw)
      }

      fixVid.addEventListener('loadedmetadata', function onMeta() {
        fixVid.removeEventListener('loadedmetadata', onMeta)
        if (fixVid.duration === Infinity || isNaN(fixVid.duration)) {
          fixVid.currentTime = 1e10
          fixVid.addEventListener('timeupdate', function onTime() {
            fixVid.removeEventListener('timeupdate', onTime)
            fixVid.currentTime = 0
            finish()
          }, { once: true })
        } else {
          finish()
        }
      }, { once: true })

      setTimeout(finish, 5000) // safety fallback
    }

    // ── Seek to start then play ──
    tempVideo.currentTime = start
    await new Promise(r => tempVideo.addEventListener('seeked', r, { once: true }))

    rec.start(200) // 200ms timeslices so audio chunks are small and in-sync
    tempVideo.play().catch(() => {})

    // ── Draw loop: stop when we reach the trim end ──
    const drawLoop = () => {
      if (tempVideo.currentTime >= end || tempVideo.ended) {
        // Stop slightly early to avoid off-by-one
        rec.stop()
        tempVideo.pause()
        return
      }
      
      const vidRatio = tempVideo.videoWidth / (tempVideo.videoHeight || 1);
      const targetRatio = targetW / targetH;
      let drawW, drawH, drawX, drawY;
      
      if (vidRatio > targetRatio) {
        drawH = targetH;
        drawW = drawH * vidRatio;
        drawX = (targetW - drawW) / 2;
        drawY = 0;
      } else {
        drawW = targetW;
        drawH = drawW / vidRatio;
        drawX = 0;
        drawY = (targetH - drawH) / 2;
      }
      
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(tempVideo, drawX, drawY, drawW, drawH)
      requestAnimationFrame(drawLoop)
    }
    requestAnimationFrame(drawLoop)
  })

  /* ── isolated export router ── */
  const executeTrim = async () => {
    try {
      return await executeTrimWebCodecs()
    } catch (err) {
      console.warn('[Recorder] WebCodecs export failed, falling back to MediaRecorder:', err)
      return await executeTrimFallback()
    }
  }

  const fmt = (s) => { if (!isFinite(s) || isNaN(s)) s = 0; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` }

  const fontSize    = FONT_SIZES[fontIdx].value
  const isLive      = phase === 'RECORDING' || phase === 'COUNTDOWN'
  const activeFilter = FILTERS[filterIdx].css

  /* ─────────────── UI ─────────────── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Hidden off-screen video — always mounted, never unmounted, used as stable canvas draw source */}
      <video
        ref={hiddenVideoRef}
        muted
        playsInline
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999, left: -9999 }}
      />

      <audio
        ref={bgMusicRef}
        src={selectedSong?.previewUrl || ''}
        loop
        style={{ display: 'none' }}
      />

      {/* ─── SETUP PHASE ─── */}
      {(phase === 'IDLE' || phase === 'PREPARING_CAMERA' || phase === 'ERROR') && (
        isMobile ? (
          /* ══ Mobile: Instagram-style camera-first screen ══ */
          <div style={S.mCam}>
            {cameraErr ? (
              <div style={S.mCamErr}>
                <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>📷</div>
                <p style={{ margin: 0, fontSize: '0.9rem', textAlign: 'center', color: '#fff' }}>{cameraErr}</p>
                <button style={{ ...S.ghostBtn, marginTop: 14, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} onClick={() => startCamera()}>Retry</button>
              </div>
            ) : (
              <>
                {/* Hidden video — stream source; canvas below draws from it */}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                />
                {/* Canvas preview — correctly shows portrait view from any stream orientation */}
                <canvas
                  ref={previewCanvasRef}
                  width={typeof window !== 'undefined' ? window.innerWidth : 390}
                  height={typeof window !== 'undefined' ? window.innerHeight : 844}
                  style={S.mCamCanvas}
                />
              </>
            )}

            {showGrid && (
              <div style={S.gridOverlay}>
                <div style={S.gridLine('33.33%', 'h')} />
                <div style={S.gridLine('66.66%', 'h')} />
                <div style={S.gridLine('33.33%', 'v')} />
                <div style={S.gridLine('66.66%', 'v')} />
              </div>
            )}

            {/* Top bar: close button and title */}
            <div style={S.mCamTop}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'rgba(0,0,0,0.50)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 32, height: 32, fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)'
                }}
                title="Close and return to Dashboard"
              >
                ✕
              </button>
              <div style={S.mCamTitle}>Recorder</div>
              <div style={{ width: 32 }} /> {/* spacer for balance */}
            </div>

            {/* Right rail: flip · grid · size · speed */}
            {renderRail([
              { icon: <FlipIcon />, cap: 'Flip', onClick: flipCamera },
              { icon: '▦', cap: 'Grid', onClick: () => setShowGrid(g => !g), active: showGrid },
              { icon: <span style={{ fontSize: '0.92rem', fontWeight: 800 }}>{FONT_SIZES[fontIdx].label}</span>, cap: 'Size', onClick: () => setFontIdx(i => (i + 1) % FONT_SIZES.length) },
              { stepper: true, cap: 'Speed', value: `${SPEEDS[speedIdx].label}×`, up: () => setSpeedIdx(i => Math.min(SPEEDS.length - 1, i + 1)), down: () => setSpeedIdx(i => Math.max(0, i - 1)) },
            ])}

            {/* Bottom deck: script chip · filter carousel · record ring */}
            <div style={S.mCamDeck}>
              <button style={S.mScriptChip} onClick={() => setEditing(true)}>
                <span style={{ fontSize: '0.95rem' }}>📄</span>
                <span style={S.mScriptChipText}>
                  {script.trim()
                    ? script.replace(/\n+/g, ' ').slice(0, 42) + (script.length > 42 ? '…' : '')
                    : 'Tap to add your script'}
                </span>
                <span style={{ opacity: 0.65, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em' }}>EDIT</span>
              </button>

              <FilterCarousel index={filterIdx} onChange={setFilterIdx} />

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  style={{ ...S.mRecordBtn, ...((!script.trim() || cameraErr) ? { opacity: 0.4 } : {}) }}
                  disabled={!script.trim() || !!cameraErr}
                  onClick={beginRecording}
                  aria-label="Start recording"
                >
                  <span style={S.mRecordInner} />
                </button>
              </div>
            </div>

            {/* Script editor bottom-sheet */}
            {editing && (
              <div style={S.mSheet}>
                <div style={S.mSheetHead}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Your Script</span>
                  <button style={S.mSheetDone} onClick={() => setEditing(false)}>Done</button>
                </div>
                <textarea
                  style={S.mSheetArea}
                  value={script}
                  onChange={e => setScript(e.target.value)}
                  placeholder="Paste or type your script here…"
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {script && <button style={S.ghostBtn} onClick={() => setScript('')}>Clear</button>}
                </div>
                {selectedSong && (
                  <label style={S.mSheetMusic}>
                    <input type="checkbox" checked={mixMusic} onChange={e => setMixMusic(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    🎵 Mix “{selectedSong.title}” into the video
                  </label>
                )}
              </div>
            )}
          </div>
        ) : (
        /* ══ Desktop: two-column setup ══ */
        <div style={{
          ...S.setupWrap,
          flexDirection: 'row',
          padding: '24px 20px',
        }}>
          {/* Page header — order: 2 on mobile to place it below the camera */}
          <div style={{ width: '100%', marginBottom: 8, order: isMobile ? 2 : 0 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Teleprompter &amp; Recorder</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Script scrolls while you record — no second device needed.
            </p>
          </div>

          {/* Left: Script editor — order:3 on mobile so it appears BELOW the camera and header */}
          <div style={{ ...S.setupLeft, ...(isMobile ? { order: 3, minWidth: '100%' } : {}) }}>
            <div style={S.sectionLabel}>Script</div>
            {editing ? (
              <textarea
                style={S.scriptEditor}
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Paste or type your script here…"
                autoFocus
              />
            ) : (
              <div
                style={{ ...S.scriptPreview, ...(script ? {} : S.scriptEmpty) }}
                onClick={() => setEditing(true)}
              >
                {script || 'Tap to paste or type your script…'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={S.ghostBtn} onClick={() => setEditing(e => !e)}>
                {editing ? 'Done' : '✏️ Edit Script'}
              </button>
              {script && (
                <button style={S.ghostBtn} onClick={() => { setScript(''); setEditing(true) }}>
                  Clear
                </button>
              )}
            </div>

            {/* Production Directions Panel */}
            {visualDirection && (
              <div style={{
                marginTop: 20,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 8 }}>
                  🎥 Production Directions
                </div>
                {visualDirection.background && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text)', marginBottom: 6 }}>
                    <strong>Background:</strong> {visualDirection.background}
                  </div>
                )}
                {visualDirection.style && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text)', marginBottom: 6 }}>
                    <strong>Shooting Style:</strong> {visualDirection.style}
                  </div>
                )}
              </div>
            )}

            {/* Music Preview and Mixing Card */}
            {selectedSong && (
              <div style={{
                marginTop: 16,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 10 }}>
                  🎵 Background Music Pick
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, background: '#E1306C',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                    boxShadow: '0 2px 8px rgba(225,48,108,0.2)', color: '#fff'
                  }}>
                    💿
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSong.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSong.artist}
                    </div>
                  </div>
                  {selectedSong.previewUrl && (
                    <button
                      type="button"
                      onClick={togglePreviewMusic}
                      style={{
                        background: isPlayingPreview ? 'rgba(225,48,108,0.1)' : 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: 34, height: 34,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem',
                        color: isPlayingPreview ? '#E1306C' : 'var(--text)'
                      }}
                    >
                      {isPlayingPreview ? '⏸' : '▶'}
                    </button>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={mixMusic}
                      onChange={e => setMixMusic(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    Mix backing track into video
                  </label>
                  {mixMusic && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontStyle: 'italic', paddingLeft: 22 }}>
                      🎧 Headphones recommended for best results.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Camera preview + settings — order:1 on mobile so it appears ABOVE the script */}
          <div style={{ ...S.setupRight, ...(isMobile ? { order: 1, minWidth: '100%' } : {}) }}>

            {/* Camera preview */}
            <div style={S.cameraBox}>
              {cameraErr ? (
                <div style={S.cameraErr}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>{cameraErr}</p>
                  <button style={{ ...S.ghostBtn, marginTop: 12 }} onClick={() => startCamera()}>Retry</button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{ ...S.cameraVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }}
                />
              )}
              {/* Rule-of-thirds grid overlay */}
              {showGrid && (
                <div style={S.gridOverlay}>
                  <div style={S.gridLine('33.33%', 'h')} />
                  <div style={S.gridLine('66.66%', 'h')} />
                  <div style={S.gridLine('33.33%', 'v')} />
                  <div style={S.gridLine('66.66%', 'v')} />
                </div>
              )}
              {/* Overlay camera controls inside preview box */}
              {!cameraErr && (
                <>
                  <button style={S.filterBtn} onClick={nextFilter} title="Change filter">
                    <span>{FILTERS[filterIdx].emoji}</span>
                    <span>{FILTERS[filterIdx].name}</span>
                  </button>
                  <button style={S.flipBtn} onClick={flipCamera} title="Flip camera">⟳</button>
                </>
              )}
            </div>

            {/* Settings */}
            <div style={S.settingsGrid}>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Grid</div>
                <div style={S.chips}>
                  <button style={{ ...S.chip, ...(showGrid ? S.chipOn : {}) }} onClick={() => setShowGrid(g => !g)}>
                    {showGrid ? '▦ On' : '▦ Off'}
                  </button>
                </div>
              </div>
              {textOverlay && (
                <div style={{ ...S.settingGroup, gridColumn: 'span 2' }}>
                  <div style={S.settingLabel}>Hook Overlay Card</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={burnOverlay}
                      onChange={e => setBurnOverlay(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    Burn overlay graphic into final video
                  </label>
                </div>
              )}
            </div>

            <button
              style={{ ...S.recordBtn, ...((!script.trim() || cameraErr) ? S.recordBtnOff : {}) }}
              disabled={!script.trim() || !!cameraErr}
              onClick={beginRecording}
            >
              ● Start Recording
            </button>
          </div>
        </div>
        )
      )}

      {/* ─── COUNTDOWN PHASE ─── */}
      {phase === 'COUNTDOWN' && (
        <div style={S.fullscreen}>
          {isMobile ? (
            <canvas
              ref={previewCanvasRef}
              width={typeof window !== 'undefined' ? window.innerWidth : 390}
              height={typeof window !== 'undefined' ? window.innerHeight : 844}
              style={S.fullVideo}
            />
          ) : (
            <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />
          )}
          <div style={S.countdownOverlay}>
            <div style={S.countdownNum}>{countdown}</div>
          </div>
        </div>
      )}

      {/* ─── RECORDING PHASE ─── */}
      {phase === 'RECORDING' && (
        <div style={S.fullscreen} className="recording-active">
          {/* Camera in background — mobile uses the shared canvas preview so the
              on-screen view matches the recorded output exactly */}
          {isMobile ? (
            <canvas
              ref={previewCanvasRef}
              width={typeof window !== 'undefined' ? window.innerWidth : 390}
              height={typeof window !== 'undefined' ? window.innerHeight : 844}
              style={S.fullVideo}
            />
          ) : (
            <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />
          )}

          {/* Dark gradient top + bottom so text is readable */}
          <div style={S.gradTop} />
          <div style={S.gradBottom} />

          {/* Scrolling script */}
          <div
            ref={scrollRef}
            style={{ ...S.scriptScroll, fontSize }}
            onScroll={e => { scrollPosRef.current = e.target.scrollTop }}
          >
            {/* padding top so first word starts at centre of screen */}
            <div style={{ height: '45vh' }} />
            <div style={S.scriptText}>
              {script.split('\n').map((line, idx) => {
                const trimmed = line.trim()
                if (trimmed.startsWith('[B-Roll:') || trimmed.startsWith('[B-roll:')) {
                  return (
                    <div key={idx} style={S.scriptBrollLine}>
                      🎬 {trimmed.replace(/^\[B-roll:\s*/i, '').replace(/\]$/, '')}
                    </div>
                  )
                }
                return (
                  <div key={idx} style={{ marginBottom: 16 }}>
                    {line}
                  </div>
                )
              })}
            </div>
            {/* padding bottom so last word can scroll fully up */}
            <div style={{ height: '55vh' }} />
          </div>

          {/* ── Top: REC + timer ── */}
          <div style={S.recTopBar}>
            <div style={S.recPill}>
              <span style={S.recPillDot} /> {fmt(elapsed)}
            </div>
          </div>

          {/* ── Right rail: flip · pause script · size · speed ── */}
          {renderRail([
            { icon: <FlipIcon />, cap: 'Flip', onClick: flipCamera },
            { icon: scrollPaused ? '▶' : '⏸', cap: 'Script', onClick: toggleScrollPause, active: scrollPaused },
            { icon: <span style={{ fontSize: '0.92rem', fontWeight: 800 }}>{FONT_SIZES[fontIdx].label}</span>, cap: 'Size', onClick: () => setFontIdx(i => (i + 1) % FONT_SIZES.length) },
            { stepper: true, cap: 'Speed', value: `${SPEEDS[speedIdx].label}×`, up: () => setSpeedIdx(i => Math.min(SPEEDS.length - 1, i + 1)), down: () => setSpeedIdx(i => Math.max(0, i - 1)) },
          ])}

          {/* ── Bottom: filter carousel + stop ring ── */}
          <div style={S.recDeck}>
            <FilterCarousel index={filterIdx} onChange={setFilterIdx} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button style={S.stopCircle} onClick={stopRecording} aria-label="Stop recording">
                <span style={S.stopSquare} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PROCESSING PHASE ─── fullscreen spinner while video encodes ─── */}
      {phase === 'PROCESSING' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            width: 64, height: 64, border: '5px solid var(--border)',
            borderTopColor: '#E1306C', borderRadius: '50%',
            animation: 'spin 0.9s linear infinite'
          }} />
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>Processing your video…</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Hang tight, this only takes a few seconds</div>
        </div>
      )}

      {/* ─── DONE PHASE ─── shown only after processing completes ─── */}
      {(phase === 'READY_TO_EDIT' || phase === 'EXPORTING') && (
        <div style={S.doneWrap}>
          {outputBlob ? (
            <div style={S.doneCard}>
            <div style={{ fontSize: '2.5rem' }}>🎬</div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' }}>Recording saved!</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.87rem' }}>
              {fmt(elapsed)} recorded · Ready to download
            </p>

            {/* ── Preview video ── */}
            <div style={{
              width: isMobile ? 160 : 220, position: 'relative',
              borderRadius: 16, overflow: 'hidden', background: '#000',
              aspectRatio: '9 / 16',
              boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)',
              margin: '0 auto'
            }}>
              <video
                ref={doneVideoRef}
                src={outputUrl || ''}
                playsInline
                preload="auto"
                onClick={() => {
                  const v = doneVideoRef.current;
                  if (!v) return;
                  if (v.paused) v.play().catch(() => {}); else v.pause();
                }}
                onPlay={() => setIsPlayingDone(true)}
                onPause={() => setIsPlayingDone(false)}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', cursor: 'pointer' }}
                onTimeUpdate={(e) => {
                  const vid = e.target;
                  setVidTime(vid.currentTime);
                  if (vid.currentTime >= (trimEnd || vid.duration || 999) - 0.05) {
                    vid.pause();
                    vid.currentTime = Math.max(0, trimStart);
                  } else if (vid.currentTime < trimStart - 0.05) {
                    vid.currentTime = Math.max(0, trimStart);
                  }
                }}
                onLoadedMetadata={() => {
                  if (doneVideoRef.current) {
                    doneVideoRef.current.currentTime = trimStart || 0;
                    setVidTime(trimStart || 0);
                  }
                }}
              />
              {/* Play/Pause Overlay */}
              {!isPlayingDone && (
                <div 
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.2)', pointerEvents: 'none'
                  }}
                >
                  <div style={{
                    width: 64, height: 64, background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '2rem', paddingLeft: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    ▶
                  </div>
                </div>
              )}
              {/* Custom Scrubber */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                padding: '30px 16px 12px', display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ color: '#fff', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {fmt(Math.max(0, vidTime - trimStart))}
                </span>
                <input
                  type="range"
                  min={0}
                  max={(trimEnd || elapsed || 1) - trimStart}
                  step="0.01"
                  value={Math.max(0, vidTime - trimStart)}
                  onChange={(e) => {
                    if (doneVideoRef.current) {
                      doneVideoRef.current.currentTime = trimStart + parseFloat(e.target.value);
                    }
                  }}
                  style={{ flex: 1, accentColor: '#E1306C', height: 4, cursor: 'pointer' }}
                />
                <span style={{ color: '#fff', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {fmt((trimEnd || elapsed || 1) - trimStart)}
                </span>
              </div>
            </div>

            {/* ── Filmstrip Trim ── */}
            <div style={{
              width: '100%', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '14px 16px', position: 'relative',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>✂️ Trim Video</div>

              <TrimBar
                blob={outputBlob}
                totalSecs={duration || elapsed}
                trimStart={trimStart}
                trimEnd={trimEnd || duration || elapsed}
                thumbs={thumbnails}
                isMobile={isMobile}
                onTrimChange={(which, val) => {
                  if (which === 'start') dispatch({ type: 'UPDATE_TRIM', payload: { start: val } })
                  else dispatch({ type: 'UPDATE_TRIM', payload: { end: val } })
                }}
                onSeek={(time) => {
                  const vid = doneVideoRef.current
                  if (vid) {
                    vid.pause()
                    vid.currentTime = Math.min(time, isFinite(vid.duration) ? vid.duration : time)
                  }
                }}
              />
            </div>

            <button
              style={{ ...S.recordBtn, opacity: phase === 'EXPORTING' ? 0.6 : 1, cursor: phase === 'EXPORTING' ? 'not-allowed' : 'pointer' }}
              onClick={handleDownload}
              disabled={phase === 'EXPORTING'}
            >
              {phase === 'EXPORTING' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Preparing Download...
                </span>
              ) : '⬇ Download (.MP4)'}
            </button>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => {
                  if (outputUrl) URL.revokeObjectURL(outputUrl)
                  dispatch({ type: 'RESET' })
                  scrollPosRef.current = 0
                }}
              >
                ↺ Record Again
              </button>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => {
                  if (outputUrl) URL.revokeObjectURL(outputUrl)
                  dispatch({ type: 'RESET' })
                  setScript('')
                  scrollPosRef.current = 0
                }}
              >
                + New Recording
              </button>
            </div>
          </div>
          ) : (
          /* Blob is null — encoding genuinely failed after processing completed */
            <div style={S.doneCard}>
              <div style={{ fontSize: '2.5rem' }}>⚠️</div>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>Something went wrong</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                The video could not be saved. Please try recording again.
              </p>
              <button
                style={{ ...S.recordBtn, marginTop: 8 }}
                onClick={() => { dispatch({ type: 'RESET' }); scrollPosRef.current = 0 }}
              >
                ↺ Try Again
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

/* ─────────────── styles ─────────────── */
const S = {

  setupWrap: {
    display: 'flex', gap: 24, padding: '24px 20px', maxWidth: 960, margin: '0 auto', width: '100%', flexWrap: 'wrap',
  },
  setupLeft: { flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column' },
  setupRight: { flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 },

  sectionLabel: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 },

  scriptEditor: {
    flex: 1, minHeight: 320, padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--accent)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: '0.92rem', lineHeight: 1.7,
    resize: 'vertical', fontFamily: 'inherit',
    outline: 'none',
  },
  scriptPreview: {
    flex: 1, minHeight: 320, padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: '0.92rem', lineHeight: 1.7,
    cursor: 'text', overflowY: 'auto', whiteSpace: 'pre-wrap',
  },
  scriptEmpty: { color: 'var(--text-faint)', fontStyle: 'italic' },

  ghostBtn: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text-faint)', padding: '8px 14px', fontSize: '0.83rem', cursor: 'pointer',
  },

  cameraBox: {
    position: 'relative', width: '100%', aspectRatio: '16/9',
    background: '#000', borderRadius: 14, overflow: 'hidden',
  },
  cameraVideo: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cameraErr: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 20, color: 'var(--text-faint)',
  },
  flipBtn: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
    borderRadius: '50%', width: 34, height: 34, fontSize: '1.1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 4,
  },
  filterBtn: {
    position: 'absolute', top: 10, left: 10,
    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
    borderRadius: '16px', padding: '6px 12px', fontSize: '0.78rem',
    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'all 0.15s',
    zIndex: 4,
  },

  settingsGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  settingGroup: { display: 'flex', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-faint)', width: 84, flexShrink: 0 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s' },
  chipOn: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },

  // filter picker
  filterStrip: {
    display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6,
    scrollbarWidth: 'none',
  },
  filterChip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
    minWidth: 64, flexShrink: 0, transition: 'all 0.18s',
  },
  filterSwatch: {
    width: 40, height: 28, borderRadius: 6, flexShrink: 0,
  },
  filterLabel: { fontSize: '1rem', lineHeight: 1 },
  filterName: {
    fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-faint)',
    textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  // grid overlay
  gridOverlay: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 },
  gridLine: (pos, dir) => dir === 'h'
    ? { position: 'absolute', top: pos, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.35)' }
    : { position: 'absolute', left: pos, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.35)' },

  // filter arrow navigation
  filterArrow: {
    width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '1.3rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s',
  },
  filterCard: {
    flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '10px 12px',
  },


  recordBtn: {
    padding: '13px', borderRadius: 12, border: 'none',
    background: '#E1306C', color: '#fff', fontWeight: 800, fontSize: '0.95rem',
    cursor: 'pointer', width: '100%', letterSpacing: '0.02em',
    boxShadow: '0 4px 16px rgba(225,48,108,0.35)',
  },
  recordBtnOff: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },

  // fullscreen recording
  fullscreen: {
    position: 'fixed', inset: 0, background: '#000', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fullVideo: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },

  gradTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '30%',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)',
    pointerEvents: 'none', zIndex: 2,
  },
  gradBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
    pointerEvents: 'none', zIndex: 2,
  },

  scriptScroll: {
    position: 'absolute', inset: 0, zIndex: 3,
    overflowY: 'scroll', overflowX: 'hidden',
    scrollbarWidth: 'none',
    padding: '0 40px',
    cursor: 'pointer',
  },
  scriptText: {
    margin: 0, color: '#fff', fontWeight: 700, lineHeight: 1.65,
    textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.9)',
    whiteSpace: 'pre-wrap',
  },
  scriptBrollLine: {
    color: '#00E5FF',
    background: 'rgba(0, 229, 255, 0.09)',
    border: '1px dashed rgba(0, 229, 255, 0.35)',
    borderRadius: 8,
    padding: '6px 12px',
    margin: '14px auto',
    fontWeight: 800,
    fontSize: '0.85em',
    maxWidth: '85%',
    textAlign: 'center',
    textShadow: 'none',
    boxShadow: '0 2px 10px rgba(0,229,255,0.05)',
  },

  hud: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5,
    paddingTop: 14, paddingLeft: 20, paddingRight: 20,
    // Respect iOS/Android system navigation bar via safe-area-inset-bottom
    paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    display: 'flex', flexDirection: 'column', gap: 14,
    pointerEvents: 'none',
  },
  hudTopRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    pointerEvents: 'all',
  },
  timer: { color: '#fff', fontWeight: 800, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em', textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  hudControls: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  hudBtn: { background: 'rgba(74, 92, 138, 0.25)', border: '1.5px solid #4A5C8A', borderRadius: '50%', color: '#fff', width: 44, height: 44, fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all' },
  hudSpeedArrow: { background: 'rgba(74, 92, 138, 0.25)', border: '1.5px solid #4A5C8A', borderRadius: '50%', color: '#fff', width: 34, height: 34, fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', flexShrink: 0 },
  hudChip: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: 'rgba(255,255,255,0.75)', padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' },
  hudChipOn: { background: 'rgba(255,255,255,0.3)', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' },
  // Stop button: giant pill, centered, impossible to miss on phone
  stopBtn: { background: '#E1306C', border: 'none', borderRadius: 100, color: '#fff', padding: '17px 52px', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 28px rgba(225,48,108,0.6)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '0.02em', pointerEvents: 'all' },
  stopDot: { width: 14, height: 14, borderRadius: 3, background: '#fff', display: 'inline-block', flexShrink: 0 },
  speedArrow: { width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },

  tapHint: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', zIndex: 5, pointerEvents: 'none' },
  recDot: { position: 'absolute', top: 18, right: 20, width: 10, height: 10, borderRadius: '50%', background: '#ff3b30', zIndex: 5, boxShadow: '0 0 8px rgba(255,59,48,0.8)', animation: 'pulse 1.2s ease-in-out infinite' },

  countdownOverlay: { position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' },
  countdownNum: { fontSize: '10rem', fontWeight: 900, color: '#fff', textShadow: '0 0 40px rgba(255,255,255,0.4)', lineHeight: 1 },

  doneWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' },
  doneCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 20px', maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' },

  /* ── right-edge control rail (shared by setup + recording) ── */
  rail: {
    position: 'absolute', right: 10, zIndex: 7,
    top: 'calc(64px + env(safe-area-inset-top, 0px))',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  railItem: {
    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  railCircle: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(20,20,20,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.22)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
    transition: 'background 0.15s, border-color 0.15s',
  },
  railCircleOn: { background: 'rgba(255,255,255,0.28)', borderColor: 'rgba(255,255,255,0.6)' },
  railCap: {
    color: '#fff', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.03em',
    textShadow: '0 1px 4px rgba(0,0,0,0.85)', opacity: 0.92,
  },
  railStack: {
    width: 44, borderRadius: 24, overflow: 'hidden',
    background: 'rgba(20,20,20,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.22)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  railStackBtn: {
    background: 'transparent', border: 'none', color: '#fff',
    width: 44, height: 30, fontSize: '0.95rem', cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  railStackVal: { color: '#fff', fontWeight: 800, fontSize: '0.8rem', padding: '1px 0' },

  /* ── Mobile immersive camera-first setup ── */
  mCam: {
    position: 'fixed', inset: 0, zIndex: 100,
    width: '100%', height: '100%',
    background: '#000', overflow: 'hidden',
  },
  mCamVideo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  mCamCanvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
  },
  mCamErr: {
    position: 'absolute', inset: 0, zIndex: 4, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.7)',
  },
  mCamTop: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 'calc(10px + env(safe-area-inset-top, 0px)) 14px 12px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
  },
  mCamTitle: { color: '#fff', fontWeight: 800, fontSize: '1rem', textShadow: '0 1px 6px rgba(0,0,0,0.6)' },
  mCamDeck: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6,
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: '20px 0 calc(16px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.25) 62%, transparent)',
  },
  mScriptChip: {
    display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'center', maxWidth: '92%',
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.22)', borderRadius: 999,
    padding: '8px 14px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer',
  },
  mScriptChipText: { maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 },
  mRecordBtn: {
    width: 74, height: 74, borderRadius: '50%', flexShrink: 0,
    background: 'transparent', border: '5px solid rgba(255,255,255,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 4px 18px rgba(0,0,0,0.45)', padding: 0,
  },
  mRecordInner: { width: 54, height: 54, borderRadius: '50%', background: '#E1306C', display: 'block' },

  /* script editor bottom-sheet */
  mSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    background: 'var(--surface)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -12px 40px rgba(0,0,0,0.5)', maxHeight: '82%',
    display: 'flex', flexDirection: 'column',
  },
  mSheetHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  mSheetDone: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 20px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
  mSheetArea: {
    width: '100%', boxSizing: 'border-box', minHeight: 200, maxHeight: '44vh',
    padding: '12px 14px', borderRadius: 12, border: '1px solid var(--accent)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.7,
    resize: 'none', fontFamily: 'inherit', outline: 'none',
  },
  mSheetMusic: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 },

  /* ── Recording overlay (Instagram-like) ── */
  recTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6,
    display: 'flex', justifyContent: 'center',
    padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 0',
  },
  recPill: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    color: '#fff', fontWeight: 700, fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums',
    padding: '6px 15px', borderRadius: 999, letterSpacing: '0.04em',
  },
  recPillDot: { width: 9, height: 9, borderRadius: '50%', background: '#ff3b30', boxShadow: '0 0 8px rgba(255,59,48,0.9)', animation: 'pulse 1.2s ease-in-out infinite' },
  recDeck: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6,
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: '18px 0 calc(20px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(to top, rgba(0,0,0,0.74), transparent)',
  },
  stopCircle: {
    width: 80, height: 80, borderRadius: '50%', background: 'transparent',
    border: '5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', padding: 0,
  },
  stopSquare: { width: 30, height: 30, borderRadius: 7, background: '#ff3b30', display: 'block' },
}
