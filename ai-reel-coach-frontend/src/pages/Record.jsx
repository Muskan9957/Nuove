import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { api } from '../api'
import { usePersistentState } from '../hooks/usePersistentState'

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
    ctx.drawImage(vid, 0, 0, 120, 68)
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
    let liveStart = localStart
    let liveEnd   = localEnd

    const onMove = (e) => {
      const cx   = e.touches ? e.touches[0].clientX : e.clientX
      const rect = stripRef.current?.getBoundingClientRect()
      if (!rect) return
      const pct  = Math.max(0, Math.min(1, (cx - rect.left) / rect.width))
      const secs = Math.round(pct * total * 10) / 10
      
      let nextPctS, nextPctE;
      if (which === 'start') {
        liveStart = Math.min(secs, liveEnd - 0.3)
        nextPctS = (liveStart / total) * 100
        nextPctE = (liveEnd / total) * 100
      } else {
        liveEnd = Math.max(secs, liveStart + 0.3)
        nextPctS = (liveStart / total) * 100
        nextPctE = (liveEnd / total) * 100
      }

      // Direct DOM manipulation for 60fps drag without React re-renders
      if (which === 'start' && startHRef.current && leftDarkRef.current && borderRef.current) {
        startHRef.current.style.left = `${nextPctS}%`
        leftDarkRef.current.style.width = `${nextPctS}%`
        borderRef.current.style.left = `${nextPctS}%`
        borderRef.current.style.width = `${nextPctE - nextPctS}%`
      } else if (which === 'end' && endHRef.current && rightDarkRef.current && borderRef.current) {
        endHRef.current.style.left = `${nextPctE}%`
        rightDarkRef.current.style.width = `${100 - nextPctE}%`
        borderRef.current.style.width = `${nextPctE - nextPctS}%`
      }

      // Throttled video seek — prevents decoder blocking (max once per 100ms)
      const now = performance.now()
      if (now - lastSeekRef.current > 100) {
        lastSeekRef.current = now
        if (seekRafRef.current) cancelAnimationFrame(seekRafRef.current)
        seekRafRef.current = requestAnimationFrame(() => {
          onSeek?.(which === 'start' ? liveStart : liveEnd)
        })
      }
    }
    const onUp = () => {
      dragRef.current = null
      // Commit final values to React state — single re-render
      setLocalStart(liveStart)
      setLocalEnd(liveEnd)
      if (which === 'start') onTrimChange('start', liveStart)
      else                   onTrimChange('end',   liveEnd)
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
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(localStart)}</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ✂️ {fmtTime(localEnd - localStart)} selected
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(localEnd)}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 2 }}>
        Drag the pink handles · Total: {fmtTime(totalSecs)}
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
  const [showGrid,   setShowGrid]   = useState(false)

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

  // Keep speedRef in sync with speedIdx state
  useEffect(() => { speedRef.current = SPEEDS[speedIdx].value }, [speedIdx])

  /* ── start camera ── */
  const startCamera = useCallback(async (facing = facingMode) => {
    dispatch({ type: 'START_CAMERA' })
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      
      let stream
      try {
        // Try forcing exact facingMode (required on iOS Safari and some Android browsers to switch)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        })
      } catch (err) {
        // Fallback for desktops/laptops which may not support exact facingMode constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
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

  /* ── flip camera ── */
  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
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
    const hint = document.getElementById('scroll-hint')
    if (hint) hint.style.opacity = '1'
    const btn = document.getElementById('scroll-btn-text')
    if (btn) btn.innerText = '⏸ Pause scroll'

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

    // Canvas uses actual camera dimensions — fixes 9:16 vs 16:9 distortion on export
    const { w: VW, h: VH } = streamDimsRef.current
    const canvas = document.createElement('canvas')
    canvas.width  = VW
    canvas.height = VH
    const ctx = canvas.getContext('2d')

    // Draw loop — applies CSS filter + mirror to every frame
    canvasLoopRef.current = true
    framesDrawnRef.current = 0
    const drawFrame = () => {
      if (!canvasLoopRef.current) return
      framesDrawnRef.current++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw filtered camera input
      ctx.filter = activeFilter
      ctx.save()
      if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
      const src = hiddenVideoRef.current
      if (src && src.readyState >= 2 && !src.paused) {
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
      }
      ctx.restore()

      // Reset filter for graphic overlay card
      ctx.filter = 'none'
      
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

    // Pick the best available MIME type
    const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    const mime  = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
    console.log('[Recorder] launchRecording: Picked MIME type', mime)

    chunksRef.current = []
    const rec = new MediaRecorder(combinedStream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000, // 8 Mbps — high quality for social sharing
    })
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
    const btn = document.getElementById('scroll-btn-text')
    if (btn) btn.innerText = scrollingRef.current ? '⏸ Pause scroll' : '▶ Resume scroll'
    const hint = document.getElementById('scroll-hint')
    if (hint) hint.style.opacity = scrollingRef.current ? '1' : '0'
  }

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
        <div style={{
          ...S.setupWrap,
          // On mobile: single column, normal flow so camera is on top via order:1
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '16px' : '24px 20px',
          // Extra bottom padding on mobile to clear the bottom nav bar
          paddingBottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : '24px',
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
              <button style={S.flipBtn} onClick={flipCamera} title="Flip camera">⟳</button>
            </div>

            {/* Settings */}
            <div style={S.settingsGrid}>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Camera</div>
                <div style={S.chips}>
                  <button style={{ ...S.chip, ...(facingMode === 'user' ? S.chipOn : {}) }} onClick={() => { setFacingMode('user'); setMirror(true); startCamera('user') }}>Front</button>
                  <button style={{ ...S.chip, ...(facingMode === 'environment' ? S.chipOn : {}) }} onClick={() => { setFacingMode('environment'); setMirror(false); startCamera('environment') }}>Back</button>
                </div>
              </div>
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

            {/* ── Filter Picker with arrows ── */}
            <div style={{ marginTop: 8 }}>
              <div style={{ ...S.sectionLabel, marginBottom: 6 }}>🎨 Cinematic Filter</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={prevFilter} style={S.speedArrow}>‹</button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 10, padding: '8px 16px', border: '1px solid var(--border)', justifyContent: 'center', height: 44 }}>
                  <span style={{ fontSize: '1.2rem' }}>{FILTERS[filterIdx].emoji}</span>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)' }}>{FILTERS[filterIdx].name}</div>
                </div>
                <button onClick={nextFilter} style={S.speedArrow}>›</button>
              </div>
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
      )}

      {/* ─── COUNTDOWN PHASE ─── */}
      {phase === 'COUNTDOWN' && (
        <div style={S.fullscreen}>
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />
          <div style={S.countdownOverlay}>
            <div style={S.countdownNum}>{countdown}</div>
          </div>
        </div>
      )}

      {/* ─── RECORDING PHASE ─── */}
      {phase === 'RECORDING' && (
        <div style={S.fullscreen} onClick={toggleScrollPause} className="recording-active">
          {/* Camera in background */}
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />

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

          {/* HUD */}
          <div style={S.hud}>
            {/* Top row: Timer | Speed arrows | Pause */}
            <div style={S.hudTopRow}>
              <div style={S.timer}>{fmt(elapsed)}</div>

              {/* Controls Group: Font Size & Speed Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
                {/* Arrow font size toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    style={S.hudSpeedArrow}
                    onClick={() => setFontIdx(i => Math.max(0, i - 1))}
                    disabled={fontIdx === 0}
                  >‹</button>
                  <div style={{ textAlign: 'center', minWidth: 22 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', lineHeight: 1 }}>{FONT_SIZES[fontIdx].label}</div>
                    <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>size</div>
                  </div>
                  <button
                    style={S.hudSpeedArrow}
                    onClick={() => setFontIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))}
                    disabled={fontIdx === FONT_SIZES.length - 1}
                  >›</button>
                </div>

                {/* Arrow speed toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    style={S.hudSpeedArrow}
                    onClick={() => setSpeedIdx(i => Math.max(0, i - 1))}
                    disabled={speedIdx === 0}
                  >‹</button>
                  <div style={{ textAlign: 'center', minWidth: 22 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', lineHeight: 1 }}>{SPEEDS[speedIdx].label}</div>
                    <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>spd</div>
                  </div>
                  <button
                    style={S.hudSpeedArrow}
                    onClick={() => setSpeedIdx(i => Math.min(SPEEDS.length - 1, i + 1))}
                    disabled={speedIdx === SPEEDS.length - 1}
                  >›</button>
                </div>
              </div>

              {/* Pause/Resume scroll — icon only, no text */}
              <button style={S.hudBtn} onClick={e => { e.stopPropagation(); toggleScrollPause() }} title={scrollingRef.current ? 'Pause scroll' : 'Resume scroll'}>
                {scrollingRef.current ? '⏸' : '▶'}
              </button>
            </div>

            {/* Giant stop button — full width pill, impossible to miss on phone */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <button style={S.stopBtn} onClick={e => { e.stopPropagation(); stopRecording() }}>
                <span style={S.stopDot} />
                Stop Recording
              </button>
            </div>
          </div>

          {/* Tap anywhere hint */}
          {/* Tap anywhere hint */}
          <div id="scroll-hint" style={{ ...S.tapHint, opacity: scrollingRef.current ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none' }}>
            Tap anywhere to pause scroll
          </div>

          {/* REC indicator */}
          <div style={S.recDot} />
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
              width: '100%', maxWidth: 440, position: 'relative',
              borderRadius: 12, overflow: 'hidden', background: '#000',
              aspectRatio: `${streamDimsRef.current.w} / ${streamDimsRef.current.h}`,
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
  hudBtn: { background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '50%', color: '#fff', width: 44, height: 44, fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all' },
  hudSpeedArrow: { background: 'rgba(255,255,255,0.30)', border: '1.5px solid rgba(255,255,255,0.65)', borderRadius: '50%', color: '#fff', width: 34, height: 34, fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', flexShrink: 0 },
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
}
