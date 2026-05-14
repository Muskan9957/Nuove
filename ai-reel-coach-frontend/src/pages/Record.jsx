import { useState, useRef, useEffect, useCallback } from 'react'

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

/* ─────────────────── component ─────────────────── */
export default function Record() {
  // script
  const [script,     setScript]     = useState(() => sessionStorage.getItem('rc_script') || '')
  const [editing,    setEditing]    = useState(false)

  // settings
  const [speedIdx,   setSpeedIdx]   = useState(2)   // default speed 3
  const [fontIdx,    setFontIdx]    = useState(1)    // M
  const [mirror,     setMirror]     = useState(true) // front cam default mirrored
  const [facingMode, setFacingMode] = useState('user')

  // steps: 'setup' | 'countdown' | 'recording' | 'done'
  const [phase,      setPhase]      = useState('setup')
  const [countdown,  setCountdown]  = useState(3)
  const [elapsed,    setElapsed]    = useState(0)
  const [scrolling,  setScrolling]  = useState(true)
  const [cameraErr,  setCameraErr]  = useState('')

  // recording
  const [outputBlob, setOutputBlob] = useState(null)
  const [outputExt,  setOutputExt]  = useState('webm')

  // refs
  const videoRef      = useRef(null)   // camera preview
  const streamRef     = useRef(null)
  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const scrollRef     = useRef(null)   // teleprompter text container
  const scrollPosRef  = useRef(0)
  const rafRef        = useRef(null)
  const timerRef      = useRef(null)
  const countdownRef  = useRef(null)

  /* ── start camera ── */
  const startCamera = useCallback(async (facing = facingMode) => {
    setCameraErr('')
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
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
    }
  }, []) // eslint-disable-line

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
      if (last !== null && scrolling) {
        const delta = ((ts - last) / 1000) * speed
        scrollPosRef.current += delta
        scrollRef.current.scrollTop = scrollPosRef.current
      }
      last = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [speedIdx, scrolling])

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

    chunksRef.current = []
    const MIMES = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm']
    const mime  = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
    const rec   = new MediaRecorder(stream, { mimeType: mime })
    recorderRef.current = rec
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      const ext  = mime.includes('mp4') ? 'mp4' : 'webm'
      setOutputBlob(blob)
      setOutputExt(ext)
      setPhase('done')
      stopScroll()
      clearInterval(timerRef.current)
    }

    rec.start(100)
    setPhase('recording')
    setElapsed(0)
    setScrolling(true)

    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    startScroll()
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    clearInterval(timerRef.current)
    stopScroll()
  }

  const toggleScrollPause = () => {
    setScrolling(s => !s)
  }

  /* ── speed change restarts scroll at new rate ── */
  useEffect(() => {
    if (phase === 'recording') { stopScroll(); startScroll() }
  }, [speedIdx]) // eslint-disable-line

  /* ── keep scrolling state in sync with ref ── */
  useEffect(() => {
    // scrolling ref used inside rAF — handled by re-reading state flag
  }, [scrolling])

  const download = () => {
    if (!outputBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(outputBlob)
    a.download = `viralcoach-recording.${outputExt}`
    a.click()
  }

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const fontSize = FONT_SIZES[fontIdx].value
  const isLive   = phase === 'recording' || phase === 'countdown'

  /* ─────────────── UI ─────────────── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ─── SETUP PHASE ─── */}
      {phase === 'setup' && (
        <div style={S.setupWrap}>
          {/* Page header — matches all other feature pages */}
          <div style={{ width: '100%', marginBottom: 8 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Record</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Script scrolls while you record — no second device needed.
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
                  style={{ ...S.cameraVideo, transform: mirror ? 'scaleX(-1)' : 'none' }}
                />
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
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none' }} />
          <div style={S.countdownOverlay}>
            <div style={S.countdownNum}>{countdown}</div>
          </div>
        </div>
      )}

      {/* ─── RECORDING PHASE ─── */}
      {phase === 'recording' && (
        <div style={S.fullscreen} onClick={toggleScrollPause}>
          {/* Camera in background */}
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none' }} />

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
            <p style={S.scriptText}>{script}</p>
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
        </div>
      )}

      {/* ─── DONE PHASE ─── */}
      {phase === 'done' && outputBlob && (
        <div style={S.doneWrap}>
          <div style={S.doneCard}>
            <div style={{ fontSize: '2.5rem' }}>🎬</div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' }}>Recording saved!</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.87rem' }}>
              {fmt(elapsed)} recorded · Ready to download
            </p>

            <video
              src={URL.createObjectURL(outputBlob)}
              controls
              style={{ width: '100%', maxWidth: 400, borderRadius: 12, background: '#000' }}
            />

            <button style={S.recordBtn} onClick={download}>
              ⬇ Download (.{outputExt.toUpperCase()})
            </button>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => { setPhase('setup'); setOutputBlob(null); scrollPosRef.current = 0 }}
              >
                ↺ Record Again
              </button>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => { setPhase('setup'); setScript(''); setOutputBlob(null); scrollPosRef.current = 0 }}
              >
                + New Recording
              </button>
            </div>
          </div>
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
  chips: { display: 'flex', gap: 6 },
  chip: { padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s' },
  chipOn: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },

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
