import { useState, useRef, useEffect, useCallback } from 'react'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { api } from '../api'
import { usePersistentState } from '../hooks/usePersistentState'

/* ─────────────── shared helpers ─────────────── */
const fmtTime = (s) => {
  if (!isFinite(s) || isNaN(s)) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ds = Math.round((s % 1) * 10)
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${ds}`
}

/* ─────────────── TrimBar ─────────────── */
function TrimBar({ blob, totalSecs, trimStart, trimEnd, onTrimChange }) {
  const [thumbs, setThumbs] = useState([])
  const stripRef = useRef(null)
  const dragRef  = useRef(null)
  const N = 14

  // Extract thumbnail frames from blob
  useEffect(() => {
    if (!blob || !totalSecs || totalSecs <= 0 || !isFinite(totalSecs)) return
    let cancelled = false
    const run = async () => {
      const vid = document.createElement('video')
      vid.muted = true
      vid.preload = 'auto'
      const url = URL.createObjectURL(blob)
      vid.src = url
      await new Promise(r => vid.addEventListener('loadedmetadata', r, { once: true }))
      if (cancelled) { URL.revokeObjectURL(url); return }
      const dur = isFinite(vid.duration) ? vid.duration : totalSecs
      const cvs = document.createElement('canvas')
      cvs.width = 120; cvs.height = 68
      const ctx = cvs.getContext('2d')
      const out = []
      for (let i = 0; i < N; i++) {
        if (cancelled) break
        vid.currentTime = (dur * i) / Math.max(N - 1, 1)
        await new Promise(r => vid.addEventListener('seeked', r, { once: true }))
        ctx.drawImage(vid, 0, 0, 120, 68)
        out.push(cvs.toDataURL('image/jpeg', 0.6))
      }
      URL.revokeObjectURL(url)
      if (!cancelled) setThumbs(out)
    }
    run().catch(() => {})
    return () => { cancelled = true }
  }, [blob, totalSecs])

  const total = totalSecs > 0 ? totalSecs : 1
  const pctS  = Math.max(0, Math.min(100, (trimStart / total) * 100))
  const pctE  = Math.max(0, Math.min(100, (trimEnd   / total) * 100))

  const startDrag = (which, ev) => {
    ev.preventDefault()
    dragRef.current = which
    const onMove = (e) => {
      const cx   = e.touches ? e.touches[0].clientX : e.clientX
      const rect = stripRef.current?.getBoundingClientRect()
      if (!rect) return
      const pct  = Math.max(0, Math.min(1, (cx - rect.left) / rect.width))
      const secs = Math.round(pct * total * 10) / 10
      if (dragRef.current === 'start') {
        onTrimChange('start', Math.min(secs, trimEnd - 0.3))
      } else {
        onTrimChange('end',   Math.max(secs, trimStart + 0.3))
      }
    }
    const onUp = () => {
      dragRef.current = null
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

  const Handle = ({ side }) => {
    const isPct = side === 'start' ? pctS : pctE
    return (
      <div
        onMouseDown={e => startDrag(side, e)}
        onTouchStart={e => startDrag(side, e)}
        style={{
          position: 'absolute', left: `${isPct}%`, top: 0, bottom: 0,
          width: 22, transform: 'translateX(-50%)',
          background: '#E1306C', cursor: 'ew-resize', zIndex: 6,
          borderRadius: side === 'start' ? '6px 0 0 6px' : '0 6px 6px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(225,48,108,0.5)',
          touchAction: 'none',
        }}
      >
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 2, height: 14, borderRadius: 2,
            background: 'rgba(255,255,255,0.9)',
            margin: '0 1px',
          }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Strip */}
      <div ref={stripRef} style={{
        position: 'relative', height: 76, width: '100%',
        overflow: 'hidden', borderRadius: 10,
        background: '#0a0a0a', cursor: 'default',
        touchAction: 'none'
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
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pctS}%`, background: 'rgba(0,0,0,0.68)',
          pointerEvents: 'none',
        }} />
        {/* Right dark region */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: `${100 - pctE}%`, background: 'rgba(0,0,0,0.68)',
          pointerEvents: 'none',
        }} />
        {/* Selection border */}
        <div style={{
          position: 'absolute', pointerEvents: 'none',
          left: `${pctS}%`, width: `${pctE - pctS}%`,
          top: 0, bottom: 0,
          border: '3px solid #E1306C',
          boxSizing: 'border-box',
        }} />
        {/* Handles */}
        <Handle side="start" />
        <Handle side="end" />
      </div>

      {/* Time labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(trimStart)}</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ✂️ {fmtTime(trimEnd - trimStart)} selected
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E1306C', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(trimEnd)}</div>
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

  // steps: 'setup' | 'countdown' | 'recording' | 'done'
  const [phase,      setPhase]      = useState('setup')
  const [countdown,  setCountdown]  = useState(3)
  const [elapsed,    setElapsed]    = useState(0)
  const [scrolling,  setScrolling]  = useState(true)
  const [cameraErr,  setCameraErr]  = useState('')

  // recording
  const [outputBlob, setOutputBlob] = useState(null)
  const [outputUrl,  setOutputUrl]  = useState(null)
  const [outputExt,  setOutputExt]  = useState('mp4')
  const [trimStart,  setTrimStart]  = useState(0)    // seconds
  const [trimEnd,    setTrimEnd]    = useState(0)    // seconds (0 = full)
  const [downloading, setDownloading] = useState(false)
  const [processing, setProcessing] = useState(false) // true while WebCodecs flushes after stop

  // production overlay metadata
  const [availableSongs] = useState(() => {
    try {
      const activeScript = sessionStorage.getItem('rc_script') || localStorage.getItem('rc_script')
      if (!activeScript) return []
      const stored = localStorage.getItem('rc_songs')
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [selectedSong, setSelectedSong] = useState(() => {
    try {
      const activeScript = sessionStorage.getItem('rc_script') || localStorage.getItem('rc_script')
      if (!activeScript) return null
      const stored = localStorage.getItem('rc_songs')
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? (parsed.find(s => s.previewUrl) || null) : null
    } catch {
      return null
    }
  })
  const [mixMusic, setMixMusic] = useState(!!selectedSong)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [textOverlay] = useState(() => {
    const activeScript = sessionStorage.getItem('rc_script') || localStorage.getItem('rc_script')
    if (!activeScript) return ''
    return localStorage.getItem('rc_text_overlay') || ''
  })
  const [burnOverlay, setBurnOverlay] = useState(true)
  const [visualDirection] = useState(() => {
    try {
      const activeScript = sessionStorage.getItem('rc_script') || localStorage.getItem('rc_script')
      if (!activeScript) return null
      const stored = localStorage.getItem('rc_visual')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // refs
  const bgMusicRef    = useRef(null)
  const videoRef      = useRef(null)   // camera preview (visible)
  const hiddenVideoRef = useRef(null)   // off-screen video used as canvas draw source
  const streamRef     = useRef(null)
  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const scrollRef     = useRef(null)   // teleprompter text container
  const scrollPosRef  = useRef(0)
  const rafRef        = useRef(null)
  const timerRef      = useRef(null)
  const countdownRef  = useRef(null)
  const canvasLoopRef = useRef(false)
  const doneVideoRef  = useRef(null)
  const elapsedRef    = useRef(0)       // mirror of elapsed for use inside callbacks
  const scrollingRef  = useRef(true)

  // Keep preview video in sync with the trim start position
  useEffect(() => {
    if (phase === 'done' && doneVideoRef.current) {
      // Pause to avoid playback while scrubbing
      doneVideoRef.current.pause()
      // Clamp to video duration (if known)
      const dur = doneVideoRef.current.duration || 0
      const clamped = Math.min(trimStart, dur)
      doneVideoRef.current.currentTime = clamped
    }
  }, [trimStart, phase])

  /* ── start camera ── */
  const startCamera = useCallback(async (facing = facingMode) => {
    setCameraErr('')
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
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      // Keep the hidden video in sync too — this is our stable canvas draw source
      if (hiddenVideoRef.current) { hiddenVideoRef.current.srcObject = stream; hiddenVideoRef.current.play().catch(() => {}) }
    } catch (e) {
      setCameraErr(e.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera in your browser settings.'
        : 'Could not access camera: ' + e.message)
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
  const startScroll = useCallback(() => {
    const speed = SPEEDS[speedIdx].value  // px per second
    let last = null
    const tick = (ts) => {
      if (!scrollRef.current) return
      if (last !== null && scrollingRef.current) {
        const delta = ((ts - last) / 1000) * speed
        scrollPosRef.current += delta
        scrollRef.current.scrollTop = scrollPosRef.current
      }
      last = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [speedIdx])

  const stopScroll = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  /* ── begin: countdown → record ── */
  const beginRecording = () => {
    if (!streamRef.current) return
    setPhase('countdown')
    setCountdown(3)
    scrollPosRef.current = 0
    if (scrollRef.current) scrollRef.current.scrollTop = 0

    let n = 3
    countdownRef.current = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(countdownRef.current)
        launchRecording()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  const launchRecording = () => {
    const stream = streamRef.current
    if (!stream) return

    // Canvas draws the filtered + mirrored camera output
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')

    // Draw loop — applies CSS filter + mirror to every frame
    canvasLoopRef.current = true
    const drawFrame = () => {
      if (!canvasLoopRef.current) return
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
    const canvasStream = canvas.captureStream(30)
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

    chunksRef.current = []
    const rec = new MediaRecorder(combinedStream, { mimeType: mime })
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

      // Fix seekability: WebM blobs from MediaRecorder have duration=Infinity
      // Seeking to a huge time forces the browser to calculate the real duration
      const tempVid = document.createElement('video')
      tempVid.muted = true
      const url = URL.createObjectURL(rawBlob)
      tempVid.src = url

      const finish = () => {
        // By keeping the object URL, the browser remembers the duration we forced it to calculate
        setOutputUrl(url)
        setOutputBlob(rawBlob)
        setOutputExt('webm')
        setTrimStart(0)
        setTrimEnd(capturedElapsed)
        setProcessing(false)
        setPhase('done')
        stopScroll()
        clearInterval(timerRef.current)
        
        // Ping streak when recording finishes
        api.pingStreak().catch(console.error)
      }

      tempVid.addEventListener('loadedmetadata', function onMeta() {
        tempVid.removeEventListener('loadedmetadata', onMeta)
        if (tempVid.duration === Infinity || isNaN(tempVid.duration)) {
          tempVid.currentTime = 1e10
          tempVid.addEventListener('timeupdate', function onTime() {
            tempVid.removeEventListener('timeupdate', onTime)
            tempVid.currentTime = 0
            finish()
          }, { once: true })
        } else {
          finish()
        }
      }, { once: true })

      // Fallback: if metadata never fires (e.g. empty recording), still transition
      setTimeout(() => {
        if (!outputBlob) {
          finish()
        }
      }, 4000)
    }

    rec.start(250) // chunk every 250ms
    elapsedRef.current = 0
    setPhase('recording')
    setElapsed(0)
    setScrolling(true)
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(e => e + 1)
    }, 1000)
    startScroll()
  }

  const stopRecording = () => {
    canvasLoopRef.current = false
    clearInterval(timerRef.current)
    stopScroll()
    setProcessing(true)
    // Works for both native MediaRecorder and our custom async WebCodecs stop
    const result = recorderRef.current?.stop()
    if (result && typeof result.then === 'function') {
      // WebCodecs async stop — processing spinner shown until done phase is set
      result.catch(err => {
        console.error('stopRecording error:', err)
        setProcessing(false)
        setPhase('done')
      })
    }
    // For native MediaRecorder, stop() is sync — onstop callback handles phase transition
  }

  const toggleScrollPause = () => {
    setScrolling(s => !s)
  }

  /* ── speed change restarts scroll at new rate ── */
  useEffect(() => {
    if (phase === 'recording') { stopScroll(); startScroll() }
  }, [speedIdx]) // eslint-disable-line

  /* ── re-attach stream whenever a new <video> element mounts (phase change) ── */
  useEffect(() => {
    if ((phase === 'countdown' || phase === 'recording') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [phase])

  /* ── keep scrolling state in sync with ref ── */
  useEffect(() => {
    scrollingRef.current = scrolling
  }, [scrolling])

  const handleDownload = async () => {
    if (!outputBlob || downloading) return
    
    // If no trim is needed, download immediately
    if (trimStart === 0 && (trimEnd === 0 || trimEnd >= elapsed - 0.5)) {
      const a = document.createElement('a')
      a.href = outputUrl
      a.download = `nuove-recording.${outputExt}`
      a.click()
      return
    }

    setDownloading(true)
    try {
      const trimmedBlob = await executeTrim()
      const url = URL.createObjectURL(trimmedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nuove-recording.webm`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      console.error(e)
    }
    setDownloading(false)
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

  /* ── trim video using canvas re-encode ── */
  const executeTrim = () => new Promise(async (resolve) => {
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

    const canvas = document.createElement('canvas')
    canvas.width  = 1280
    canvas.height = 720
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

    const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    const mime  = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
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
    tempVideo.play()

    // ── Draw loop: stop when we reach the trim end ──
    const drawLoop = () => {
      if (tempVideo.currentTime >= end || tempVideo.ended) {
        // Stop slightly early to avoid off-by-one
        rec.stop()
        tempVideo.pause()
        return
      }
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height)
      requestAnimationFrame(drawLoop)
    }
    requestAnimationFrame(drawLoop)
  })

  const fmt = (s) => { if (!isFinite(s) || isNaN(s)) s = 0; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` }

  const fontSize    = FONT_SIZES[fontIdx].value
  const isLive      = phase === 'recording' || phase === 'countdown'
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
      {phase === 'setup' && (
        <div style={S.setupWrap}>
          {/* Page header ,  matches all other feature pages */}
          <div style={{ width: '100%', marginBottom: 8 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Teleprompter &amp; Recorder</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Script scrolls while you record ,  no second device needed.
            </p>
          </div>

          {/* Left: Script editor */}
          <div style={S.setupLeft}>
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

          {/* Right: Camera preview + settings */}
          <div style={S.setupRight}>

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
                <div style={S.settingLabel}>Scroll speed</div>
                <div style={S.chips}>
                  {SPEEDS.map((s, i) => (
                    <button key={i} style={{ ...S.chip, ...(speedIdx === i ? S.chipOn : {}) }} onClick={() => setSpeedIdx(i)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Font size</div>
                <div style={S.chips}>
                  {FONT_SIZES.map((f, i) => (
                    <button key={i} style={{ ...S.chip, ...(fontIdx === i ? S.chipOn : {}) }} onClick={() => setFontIdx(i)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
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
            <div>
              <div style={S.sectionLabel}>🎨 Cinematic Filters</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={prevFilter} style={S.filterArrow}>‹</button>
                <div style={S.filterCard}>
                  <div style={{ ...S.filterSwatch, width: '100%', height: 44, marginBottom: 6, background: FILTERS[filterIdx].swatch }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>{FILTERS[filterIdx].emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{FILTERS[filterIdx].name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>{FILTERS[filterIdx].desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
                    {FILTERS.map((_, i) => (
                      <div key={i} onClick={() => setFilterIdx(i)} style={{
                        width: i === filterIdx ? 18 : 6, height: 6, borderRadius: 99,
                        background: i === filterIdx ? 'var(--accent)' : 'var(--border)',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }} />
                    ))}
                  </div>
                </div>
                <button onClick={nextFilter} style={S.filterArrow}>›</button>
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
      {phase === 'countdown' && (
        <div style={S.fullscreen}>
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />
          <div style={S.countdownOverlay}>
            <div style={S.countdownNum}>{countdown}</div>
          </div>
        </div>
      )}

      {/* ─── RECORDING PHASE ─── */}
      {phase === 'recording' && (
        <div style={S.fullscreen} onClick={toggleScrollPause}>
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
            {/* Timer */}
            <div style={S.timer}>{fmt(elapsed)}</div>

            {/* Pause / speed controls */}
            <div style={S.hudControls} onClick={e => e.stopPropagation()}>
              <button style={S.hudBtn} onClick={toggleScrollPause}>
                {scrolling ? '⏸ Pause scroll' : '▶ Resume scroll'}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                {SPEEDS.map((s, i) => (
                  <button key={i} style={{ ...S.hudChip, ...(speedIdx === i ? S.hudChipOn : {}) }} onClick={() => setSpeedIdx(i)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stop */}
            <button style={S.stopBtn} onClick={e => { e.stopPropagation(); stopRecording() }}>
              ■ Stop
            </button>
          </div>

          {/* Tap anywhere hint */}
          {scrolling && (
            <div style={S.tapHint}>Tap anywhere to pause scroll</div>
          )}

          {/* REC indicator */}
          <div style={S.recDot} />

          {/* Processing overlay — shown while encoders flush after pressing stop */}
          {processing && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
            }}>
              <div style={{
                width: 48, height: 48, border: '4px solid rgba(255,255,255,0.2)',
                borderTopColor: '#E1306C', borderRadius: '50%',
                animation: 'spin 0.9s linear infinite'
              }} />
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Saving your video...</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>Encoding to MP4, just a moment</div>
            </div>
          )}
        </div>
      )}

      {/* ─── DONE PHASE ─── */}
      {phase === 'done' && (
        <div style={S.doneWrap}>
          {outputBlob ? (
            <div style={S.doneCard}>
            <div style={{ fontSize: '2.5rem' }}>🎬</div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' }}>Recording saved!</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.87rem' }}>
              {fmt(elapsed)} recorded · Ready to download
            </p>

            <video
              ref={doneVideoRef}
              src={outputUrl || ''}
              controls
              disablePictureInPicture
              controlsList="nodownload noremoteplayback"
              style={{ width: '100%', maxWidth: 440, borderRadius: 12, background: '#000' }}
            />

            {/* ── Filmstrip Trim ── */}
            <div style={{
              width: '100%', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '14px 16px', position: 'relative',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>✂️ Trim Video</div>

              <TrimBar
                blob={outputBlob}
                totalSecs={trimEnd || elapsed}
                trimStart={trimStart}
                trimEnd={trimEnd || elapsed}
                onTrimChange={(which, val) => {
                  if (which === 'start') {
                    setTrimStart(val)
                    // Update preview to show the new start frame
                    if (doneVideoRef.current) {
                      doneVideoRef.current.pause()
                      const dur = doneVideoRef.current.duration || 0
                      doneVideoRef.current.currentTime = Math.min(val, dur)
                    }
                  } else {
                    setTrimEnd(val)
                  }
                }}
              />
            </div>

            <button
              style={{ ...S.recordBtn, opacity: downloading ? 0.6 : 1, cursor: downloading ? 'not-allowed' : 'pointer' }}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
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
                  setPhase('setup'); setOutputBlob(null); setOutputUrl(null); scrollPosRef.current = 0
                }}
              >
                ↺ Record Again
              </button>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => {
                  if (outputUrl) URL.revokeObjectURL(outputUrl)
                  setPhase('setup'); setScript(''); setOutputBlob(null); setOutputUrl(null); scrollPosRef.current = 0
                }}
              >
                + New Recording
              </button>
            </div>
          </div>
        ) : (
          /* Blob is null — encoding failed, show error + retry */
            <div style={S.doneCard}>
              <div style={{ fontSize: '2.5rem' }}>⚠️</div>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>Something went wrong</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                The video could not be saved. Please try recording again.
              </p>
              <button
                style={{ ...S.recordBtn, marginTop: 8 }}
                onClick={() => { setPhase('setup'); setOutputBlob(null); setOutputUrl(null); setProcessing(false); scrollPosRef.current = 0 }}
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
    position: 'fixed', inset: 0, background: '#000', zIndex: 100,
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
    padding: '14px 20px 32px',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
  },
  timer: { color: '#fff', fontWeight: 800, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em', textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  hudControls: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  hudBtn: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, color: '#fff', padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' },
  hudChip: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: 'rgba(255,255,255,0.75)', padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' },
  hudChipOn: { background: 'rgba(255,255,255,0.3)', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' },
  stopBtn: { background: 'rgba(225,48,108,0.85)', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)' },

  tapHint: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', zIndex: 5, pointerEvents: 'none' },
  recDot: { position: 'absolute', top: 18, right: 20, width: 10, height: 10, borderRadius: '50%', background: '#ff3b30', zIndex: 5, boxShadow: '0 0 8px rgba(255,59,48,0.8)', animation: 'pulse 1.2s ease-in-out infinite' },

  countdownOverlay: { position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' },
  countdownNum: { fontSize: '10rem', fontWeight: 900, color: '#fff', textShadow: '0 0 40px rgba(255,255,255,0.4)', lineHeight: 1 },

  doneWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' },
  doneCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '32px 28px', maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' },
}
