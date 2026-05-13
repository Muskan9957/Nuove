import { useState, useRef, useCallback, useEffect } from 'react'
import { api } from '../api'
import { useToast } from '../components/Toast'
import { getSavedRegion } from '../utils/detectRegion'

/* ─────────────────────────── helpers ─────────────────────────── */
const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const extractVideoFrames = (file, numFrames = 4) =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url   = URL.createObjectURL(file)
    video.src   = url
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      const duration = video.duration
      if (!isFinite(duration) || duration === 0) {
        URL.revokeObjectURL(url)
        return reject(new Error('Could not read video duration'))
      }
      const canvas = document.createElement('canvas')
      canvas.width  = 480
      canvas.height = 854
      const ctx = canvas.getContext('2d')
      const times = Array.from({ length: numFrames }, (_, i) =>
        Math.min(((i + 0.5) / numFrames) * duration, duration - 0.1)
      )
      const frames = []
      let idx = 0
      const next = () => { video.currentTime = times[idx] }
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, 480, 854)
        frames.push(canvas.toDataURL('image/jpeg', 0.75).split(',')[1])
        idx++
        if (idx >= times.length) { URL.revokeObjectURL(url); resolve(frames) }
        else next()
      }
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video seek failed')) }
      next()
    }
    video.onerror = () => reject(new Error('Could not load file'))
    video.load()
  })

const FILTERS = [
  { id: 'original',  label: 'Original',  css: 'none' },
  { id: 'warm',      label: 'Warm',      css: 'sepia(0.25) saturate(1.3) brightness(1.05) contrast(1.02)' },
  { id: 'bright',    label: 'Bright',    css: 'brightness(1.2) contrast(1.05) saturate(1.1)' },
  { id: 'cinematic', label: 'Cinematic', css: 'contrast(1.2) saturate(0.75) brightness(0.9)' },
  { id: 'moody',     label: 'Moody',     css: 'brightness(0.8) contrast(1.3) saturate(0.65) hue-rotate(10deg)' },
  { id: 'cool',      label: 'Cool',      css: 'hue-rotate(20deg) saturate(1.1) brightness(1.05)' },
]

const CAPTION_POSITIONS = [
  { id: 'top',    label: 'Top' },
  { id: 'center', label: 'Center' },
  { id: 'bottom', label: 'Bottom' },
]

const CAPTION_COLORS = [
  { id: 'white',  label: 'White',  fill: '#ffffff', stroke: '#000000' },
  { id: 'yellow', label: 'Yellow', fill: '#FFE600', stroke: '#000000' },
  { id: 'black',  label: 'Black',  fill: '#111111', stroke: '#ffffff' },
  { id: 'pink',   label: 'Pink',   fill: '#FF6EC7', stroke: '#000000' },
]

const AUDIENCES = ['India', 'US', 'UK', 'Middle East', 'Southeast Asia', 'Global']
const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
]

/* ─────────────────── iTunes enrichment ─────────────────────── */
async function enrichWithiTunes(songs, audience) {
  const country = audience === 'India' ? 'in' : 'us'
  return Promise.all(
    songs.map(async (song) => {
      try {
        const r   = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${song.title} ${song.artist}`)}&entity=song&limit=1&country=${country}`)
        const d   = await r.json()
        const hit = d.results?.[0]
        return {
          ...song,
          previewUrl: hit?.previewUrl || null,
          artworkUrl: hit?.artworkUrl60?.replace('60x60', '100x100') || null,
        }
      } catch {
        return song
      }
    })
  )
}

/* ─────────────────── render engine ─────────────────────── */
function drawWrappedCaption(ctx, text, position, colorObj, canvasW, canvasH) {
  const maxW    = canvasW - 80
  const fontSize = 52
  ctx.font      = `bold ${fontSize}px Arial, sans-serif`
  ctx.textAlign = 'center'

  const words = text.split(' ')
  const lines = []
  let line    = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)

  const lineH  = fontSize * 1.38
  const totalH = lines.length * lineH
  const padX   = 32, padY = 18
  const boxW   = maxW + padX * 2

  let baseY
  if (position === 'top')         baseY = 160
  else if (position === 'center') baseY = (canvasH - totalH) / 2
  else                            baseY = canvasH - 180 - totalH

  ctx.fillStyle = 'rgba(0,0,0,0.48)'
  const boxX = (canvasW - boxW) / 2
  const boxH = totalH + padY * 2
  ctx.beginPath()
  ctx.roundRect(boxX, baseY - padY, boxW, boxH, 20)
  ctx.fill()

  ctx.fillStyle   = colorObj.fill
  ctx.strokeStyle = colorObj.stroke
  ctx.lineWidth   = 3
  lines.forEach((ln, i) => {
    const y = baseY + i * lineH + fontSize
    ctx.strokeText(ln, canvasW / 2, y)
    ctx.fillText(ln,   canvasW / 2, y)
  })
}

function cropDraw(ctx, source, canvasW, canvasH, sourceW, sourceH) {
  const targetAspect = canvasW / canvasH
  let sx = 0, sy = 0, sw = sourceW, sh = sourceH
  if (sourceW / sourceH > targetAspect) {
    sw = sourceH * targetAspect
    sx = (sourceW - sw) / 2
  } else {
    sh = sourceW / targetAspect
    sy = (sourceH - sh) / 2
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvasW, canvasH)
}

async function renderReel({ mediaFile, mediaType, selectedSong, selectedCaption, filter, captionPosition, captionColor, apiBase }) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const filterCss = FILTERS.find(f => f.id === filter)?.css || 'none'
  const capColor  = CAPTION_COLORS.find(c => c.id === captionColor) || CAPTION_COLORS[0]
  const objectUrl = URL.createObjectURL(mediaFile)
  const isVideo   = mediaType.startsWith('video/')

  // audio
  const audioCtx  = new (window.AudioContext || window.webkitAudioContext)()
  const destNode  = audioCtx.createMediaStreamDestination()
  let audioBuf    = null

  if (selectedSong?.previewUrl) {
    try {
      const proxied  = `${apiBase}/api/reel-ready/audio?url=${encodeURIComponent(selectedSong.previewUrl)}`
      const resp     = await fetch(proxied)
      const arrBuf   = await resp.arrayBuffer()
      audioBuf       = await audioCtx.decodeAudioData(arrBuf)
    } catch (e) {
      console.warn('Audio proxy failed, rendering muted:', e)
    }
  }

  const MIMES    = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm']
  const mime     = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
  const ext      = mime.includes('mp4') ? 'mp4' : 'webm'

  /* ── video branch ── */
  if (isVideo) {
    const videoEl = document.createElement('video')
    videoEl.src          = objectUrl
    videoEl.muted        = true
    videoEl.playsInline  = true
    videoEl.crossOrigin  = 'anonymous'
    await new Promise(r => videoEl.addEventListener('loadeddata', r, { once: true }))
    const duration = Math.min(videoEl.duration, 30)

    const canvasStream = canvas.captureStream(30)
    if (audioBuf) {
      const src = audioCtx.createBufferSource()
      src.buffer = audioBuf
      src.connect(destNode)
      src.start(0)
    }
    destNode.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t))

    const recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
    const chunks   = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.start(100)
    videoEl.play()

    let frameId
    const drawFrame = () => {
      ctx.filter = filterCss
      cropDraw(ctx, videoEl, W, H, videoEl.videoWidth, videoEl.videoHeight)
      ctx.filter = 'none'
      if (selectedCaption) drawWrappedCaption(ctx, selectedCaption, captionPosition, capColor, W, H)
      frameId = requestAnimationFrame(drawFrame)
    }
    drawFrame()

    await new Promise(r => setTimeout(r, duration * 1000))
    cancelAnimationFrame(frameId)
    videoEl.pause()
    recorder.stop()
    await new Promise(r => { recorder.onstop = r })
    audioCtx.close()
    URL.revokeObjectURL(objectUrl)
    return { blob: new Blob(chunks, { type: mime }), ext }
  }

  /* ── image branch — 10 sec loop ── */
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = objectUrl
  await new Promise(r => { img.onload = r })

  ctx.filter = filterCss
  cropDraw(ctx, img, W, H, img.naturalWidth, img.naturalHeight)
  ctx.filter = 'none'
  if (selectedCaption) drawWrappedCaption(ctx, selectedCaption, captionPosition, capColor, W, H)

  const canvasStream = canvas.captureStream(30)
  if (audioBuf) {
    const src = audioCtx.createBufferSource()
    src.buffer = audioBuf
    src.connect(destNode)
    src.start(0)
  }
  destNode.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t))

  const recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 3_000_000 })
  const chunks   = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start(100)

  await new Promise(r => setTimeout(r, 10_000))
  recorder.stop()
  await new Promise(r => { recorder.onstop = r })
  audioCtx.close()
  URL.revokeObjectURL(objectUrl)
  return { blob: new Blob(chunks, { type: mime }), ext }
}

/* ══════════════════════════════════════════════════════════════ */
/*                       MAIN COMPONENT                          */
/* ══════════════════════════════════════════════════════════════ */
export default function ReelReady() {
  const toast = useToast()

  // steps: 0=upload, 1=analysing, 2=studio, 3=rendering, 4=done
  const [step,  setStep]  = useState(0)

  // file
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [fileType,  setFileType]  = useState(null) // 'image'|'video'
  const [dragging,  setDragging]  = useState(false)
  const fileInputRef = useRef(null)

  // form
  const [audience, setAudience] = useState(getSavedRegion() || 'India')
  const [language, setLanguage] = useState('en')

  // analysis
  const [analysis,  setAnalysis]  = useState(null)
  const [songs,     setSongs]     = useState([])

  // studio
  const [captions,        setCaptions]        = useState([])
  const [selectedCaption, setSelectedCaption] = useState('')
  const [selectedSong,    setSelectedSong]    = useState(null)
  const [filter,          setFilter]          = useState('original')
  const [captionPos,      setCaptionPos]      = useState('bottom')
  const [captionColor,    setCaptionColor]    = useState('white')
  const [captionLoading,  setCaptionLoading]  = useState(false)

  // audio player
  const [playingKey,    setPlayingKey]    = useState(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const audioRef    = useRef(null)
  const progressRef = useRef(null)

  // render
  const [renderPct,  setRenderPct]  = useState(0)
  const [outputBlob, setOutputBlob] = useState(null)
  const [outputExt,  setOutputExt]  = useState('webm')
  const [error,      setError]      = useState('')

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null }
    setPlayingKey(null)
    setAudioProgress(0)
  }, [])

  useEffect(() => () => stopAudio(), [stopAudio])

  /* ── file handling ────────────────────────────────────────────── */
  const handleFile = useCallback((f) => {
    if (!f) return
    const isVideo = f.type.startsWith('video/')
    const isImage = f.type.startsWith('image/')
    if (!isVideo && !isImage) { toast('Please upload an image or video file', 'error'); return }
    if (f.size > 150 * 1024 * 1024) { toast('File too large — max 150 MB', 'error'); return }
    setFile(f)
    setFileType(isVideo ? 'video' : 'image')
    setPreview(URL.createObjectURL(f))
    setStep(0)
    setAnalysis(null)
    setOutputBlob(null)
    setError('')
    stopAudio()
  }, [toast, stopAudio])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  /* ── analyse ──────────────────────────────────────────────────── */
  const analyse = async () => {
    if (!file) return
    setStep(1)
    setError('')
    stopAudio()
    try {
      let frames, mediaTypes
      if (fileType === 'video') {
        frames     = await extractVideoFrames(file, 4)
        mediaTypes = frames.map(() => 'image/jpeg')
      } else {
        frames     = [await readFileAsBase64(file)]
        mediaTypes = [file.type]
      }

      const { analysis: an, songs: rawSongs } = await api.reelReady({ frames, mediaTypes, audience, language })
      const enriched = await enrichWithiTunes(rawSongs || [], audience)

      setAnalysis(an)
      setCaptions(an.captions || [])
      setSongs(enriched)
      setSelectedCaption(an.captions?.[0]?.text || '')
      setSelectedSong(null)
      setStep(2)
    } catch (e) {
      setError(e.message || 'Analysis failed. Please try again.')
      setStep(0)
      toast(e.message || 'Analysis failed', 'error')
    }
  }

  /* ── more captions ────────────────────────────────────────────── */
  const moreCaptions = async () => {
    if (!analysis) return
    setCaptionLoading(true)
    try {
      const { captions: fresh } = await api.reelMoreCaptions({
        contentUnderstanding: analysis.contentUnderstanding,
        topic  : analysis.topic,
        niche  : analysis.niche,
        tone   : analysis.tone,
        mood   : analysis.mood,
        audience,
        language,
      })
      setCaptions(fresh)
      setSelectedCaption(fresh[0]?.text || '')
    } catch (e) {
      toast(e.message || 'Could not generate captions', 'error')
    } finally {
      setCaptionLoading(false)
    }
  }

  /* ── audio player ─────────────────────────────────────────────── */
  const togglePlay = (song) => {
    const key = song.title + song.artist
    if (playingKey === key) { stopAudio(); return }
    stopAudio()
    if (!song.previewUrl) return
    const audio = new Audio(song.previewUrl)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingKey(key)
    setAudioProgress(0)
    audio.onended = () => { stopAudio() }
    progressRef.current = setInterval(() => {
      if (!audioRef.current) return
      const pct = (audioRef.current.currentTime / (audioRef.current.duration || 30)) * 100
      setAudioProgress(isNaN(pct) ? 0 : pct)
    }, 200)
  }

  /* ── render ───────────────────────────────────────────────────── */
  const render = async () => {
    if (!file) return
    setStep(3)
    setRenderPct(0)
    setError('')
    stopAudio()

    const tick = setInterval(() => setRenderPct(p => Math.min(p + 2, 92)), 600)
    try {
      const apiBase = import.meta.env.VITE_API_URL || ''
      const { blob, ext } = await renderReel({
        mediaFile: file,
        mediaType: file.type,
        selectedSong,
        selectedCaption,
        filter,
        captionPosition: captionPos,
        captionColor,
        apiBase,
      })
      clearInterval(tick)
      setRenderPct(100)
      setOutputBlob(blob)
      setOutputExt(ext)
      setStep(4)
    } catch (e) {
      clearInterval(tick)
      setError('Render failed: ' + (e.message || 'unknown error'))
      setStep(2)
      toast('Render failed: ' + (e.message || 'unknown'), 'error')
    }
  }

  /* ── download ─────────────────────────────────────────────────── */
  const download = () => {
    if (!outputBlob) return
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(outputBlob)
    a.download = `reel-ready.${outputExt}`
    a.click()
  }

  const activeFilter = FILTERS.find(f => f.id === filter) || FILTERS[0]

  /* ══════════════════ RENDER ══════════════════ */
  return (
    <div className="page-enter" style={{ maxWidth: 920, margin: '0 auto', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Reel Ready</h1>
          <span style={badge}>New</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.91rem', lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
          Upload your photo or video → get captions, hashtags &amp; music already mixed in → download and post directly.
        </p>
      </div>

      {/* Step indicator */}
      <StepBar step={step} />

      {error && (
        <div style={errorBanner}>{error}</div>
      )}

      {/* ── STEP 0: Upload ── */}
      {(step === 0 || step === 1) && (
        <div style={card}>
          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ ...dropzone, ...(dragging ? dropzoneDrag : {}) }}
            >
              <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>📲</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: 6 }}>
                Drop your photo or video here
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 18 }}>
                or click to browse · JPG, PNG, MP4, MOV · up to 150 MB
              </div>
              <span style={igGradBtn}>Choose File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {fileType === 'image'
                  ? <img src={preview} alt="preview" style={thumbStyle} />
                  : <video src={preview} muted style={thumbStyle} />
                }
                <button
                  onClick={() => { setFile(null); setPreview(null); setFileType(null) }}
                  style={removeBtn}
                >✕</button>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: 2 }}>{file.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', marginBottom: 14 }}>
                  {fileType === 'video' ? '🎥 Video' : '🖼 Image'} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={microLabel}>Audience</div>
                    <select value={audience} onChange={e => setAudience(e.target.value)} className="select" style={{ fontSize: '0.82rem', padding: '6px 10px' }}>
                      {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={microLabel}>Language</div>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className="select" style={{ fontSize: '0.82rem', padding: '6px 10px' }}>
                      {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {file && (
            <button
              onClick={analyse}
              disabled={step === 1}
              style={{ ...analyseBtn, ...(step === 1 ? analyseBtnDisabled : {}) }}
            >
              {step === 1 ? (
                <><span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--text-muted)' }} /> Analysing your content…</>
              ) : (
                <>✦ Analyse &amp; Build Reel</>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2: Studio ── */}
      {step === 2 && analysis && (
        <div style={studioGrid}>

          {/* Left — phone preview */}
          <div style={studioLeft}>
            <div style={phoneFrame}>
              <div style={phoneScreen}>
                {preview && (
                  fileType === 'video'
                    ? <video src={preview} style={{ ...phoneMedia, filter: activeFilter.css }} muted playsInline autoPlay loop />
                    : <img src={preview} alt="preview" style={{ ...phoneMedia, filter: activeFilter.css }} />
                )}
                {selectedCaption && (
                  <div style={{ ...captionOverlay, ...captionOverlayPosition(captionPos) }}>
                    <p style={{ ...captionOverlayText, color: CAPTION_COLORS.find(c => c.id === captionColor)?.fill || '#fff' }}>
                      {selectedCaption}
                    </p>
                  </div>
                )}
                {selectedSong && (
                  <div style={songBadge}>🎵 {selectedSong.title}</div>
                )}
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 8 }}>Live preview</p>
          </div>

          {/* Right — controls */}
          <div style={studioRight}>

            {/* AI insight */}
            <div style={{ ...card, borderLeft: '3px solid rgba(252,175,69,0.5)', marginBottom: 0, padding: '14px 18px' }}>
              <div style={microLabel}>👁 AI understands</div>
              <p style={{ margin: '4px 0 8px', fontSize: '0.87rem', color: 'var(--text)', lineHeight: 1.55 }}>{analysis.contentUnderstanding}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {analysis.niche && <Chip label={analysis.niche} color="#FCAF45" />}
                {analysis.tone  && <Chip label={analysis.tone}  color="#E1306C" />}
                {analysis.mood  && <Chip label={analysis.mood}  color="#833AB4" />}
              </div>
            </div>

            {/* Captions */}
            <SectionCard title="Caption" icon="✍️">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
                {captions.map((c, i) => (
                  <div
                    key={i}
                    style={{ ...captionCard, ...(selectedCaption === c.text ? captionCardActive : {}) }}
                    onClick={() => setSelectedCaption(c.text)}
                  >
                    <span style={captionBadge}>{c.label}</span>
                    <p style={captionText}>{c.text}</p>
                  </div>
                ))}
              </div>
              <button style={ghostBtn} onClick={moreCaptions} disabled={captionLoading}>
                {captionLoading ? '⏳ Generating…' : '✦ Generate More Captions'}
              </button>
            </SectionCard>

            {/* Songs */}
            <SectionCard title="Song" icon="🎵" sub="Tap artwork to preview · Tap Use to select">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {songs.map((song, i) => {
                  const skey    = song.title + song.artist
                  const playing = playingKey === skey
                  const active  = selectedSong?.title === song.title
                  return (
                    <div key={i} style={{ ...songCard, ...(active ? songCardActive : {}) }}>
                      <div style={songArtWrap} onClick={() => togglePlay(song)}>
                        {song.artworkUrl
                          ? <img src={song.artworkUrl} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }} />
                          : <div style={songArtFallback}>♪</div>
                        }
                        <div style={playOverlay}>{playing ? '⏸' : '▶'}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={songTitle}>{song.title}</div>
                        <div style={songArtist}>{song.artist}</div>
                        {playing && (
                          <div style={progressBar}>
                            <div style={{ ...progressFill, width: `${audioProgress}%` }} />
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        {song.previewUrl && <span style={previewPill}>30s</span>}
                        <button
                          style={{ ...useBtn, ...(active ? useBtnActive : {}) }}
                          onClick={() => setSelectedSong(active ? null : song)}
                        >
                          {active ? '✓ Using' : 'Use'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Style */}
            <SectionCard title="Style &amp; Edits" icon="🎨">
              <div style={microLabel}>Filter</div>
              <div style={chipRow}>
                {FILTERS.map(f => (
                  <button key={f.id} style={{ ...chipBtn, ...(filter === f.id ? chipBtnActive : {}) }} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ ...microLabel, marginTop: 12 }}>Caption Position</div>
              <div style={chipRow}>
                {CAPTION_POSITIONS.map(p => (
                  <button key={p.id} style={{ ...chipBtn, ...(captionPos === p.id ? chipBtnActive : {}) }} onClick={() => setCaptionPos(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ ...microLabel, marginTop: 12 }}>Caption Color</div>
              <div style={chipRow}>
                {CAPTION_COLORS.map(c => (
                  <button
                    key={c.id}
                    title={c.label}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c.fill, border: captionColor === c.id ? '2px solid var(--accent)' : '2px solid var(--border)', cursor: 'pointer', outline: captionColor === c.id ? '2px solid var(--accent)' : 'none', outlineOffset: 2 }}
                    onClick={() => setCaptionColor(c.id)}
                  />
                ))}
              </div>
            </SectionCard>

            {/* Hashtags */}
            {analysis.hashtags && (
              <SectionCard title="Hashtags" icon="#️⃣">
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint)', lineHeight: 1.8, wordBreak: 'break-word' }}>
                  {[...(analysis.hashtags.niche || []), ...(analysis.hashtags.broad || []), ...(analysis.hashtags.trending || [])].join(' ')}
                </p>
              </SectionCard>
            )}

            {/* Render */}
            <button
              onClick={render}
              disabled={step === 3}
              style={{ ...renderBtn, ...(step === 3 ? renderBtnDisabled : {}) }}
            >
              🎬 Render &amp; Export Reel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Rendering ── */}
      {step === 3 && (
        <div style={{ ...card, alignItems: 'center', textAlign: 'center', gap: 16, padding: 48 }}>
          <div style={{ fontSize: '2.5rem' }}>🎬</div>
          <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text)' }}>Rendering your reel…</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            This takes 10–30 seconds. Please keep this tab open.
          </p>
          <div style={{ width: '100%', maxWidth: 360, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#FCAF45,#E1306C)', borderRadius: 3, width: `${renderPct}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint)' }}>{renderPct}%</p>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 4 && outputBlob && (
        <div style={{ ...card, alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.4rem', color: 'var(--text)' }}>Your Reel is Ready!</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 400 }}>
            Your video has been rendered with the song, caption and style you selected. Download and post it directly.
          </p>

          <video
            src={URL.createObjectURL(outputBlob)}
            controls
            style={{ width: '100%', maxWidth: 360, maxHeight: 480, borderRadius: 14, background: '#000', objectFit: 'contain' }}
          />

          <button style={renderBtn} onClick={download}>
            ⬇ Download Reel (.{outputExt.toUpperCase()})
          </button>

          {analysis?.hashtags && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', width: '100%', textAlign: 'left' }}>
              <div style={{ ...microLabel, marginBottom: 6 }}>Copy these hashtags</div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.8, wordBreak: 'break-word' }}>
                {[...(analysis.hashtags.niche || []), ...(analysis.hashtags.broad || []), ...(analysis.hashtags.trending || [])].join(' ')}
              </p>
            </div>
          )}

          <button
            style={{ ...ghostBtn, marginTop: 4 }}
            onClick={() => { setStep(0); setFile(null); setPreview(null); setOutputBlob(null); setAnalysis(null); setSongs([]); setCaptions([]) }}
          >
            ← Start Over
          </button>
        </div>
      )}

      {/* spin keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ─────────────── sub-components ─────────────── */
function StepBar({ step }) {
  const steps = ['Upload', 'Analyse', 'Studio', 'Download']
  const activeIdx = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 2 : 3
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done   = i < activeIdx
        const active = i === activeIdx
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, fontSize: '0.74rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--accent)' : done ? 'color-mix(in srgb,var(--accent) 20%,transparent)' : 'var(--surface2)', color: active ? '#fff' : done ? 'var(--accent)' : 'var(--text-faint)' }}>
              {done ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: active || done ? 'var(--accent)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>{s}</span>
            {i < 3 && <div style={{ width: 36, height: 2, background: done ? 'var(--accent)' : 'var(--border)', margin: '0 4px', flexShrink: 0 }} />}
          </div>
        )
      })}
    </div>
  )
}

function SectionCard({ title, icon, sub, children }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: '1.05rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: title }} />
        {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: 'auto' }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function Chip({ label, color }) {
  return (
    <span style={{ fontSize: '0.71rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

function captionOverlayPosition(pos) {
  if (pos === 'top')    return { top: 24, bottom: 'auto', transform: 'none' }
  if (pos === 'center') return { top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }
  return { bottom: 24, top: 'auto', transform: 'none' }
}

/* ─────────────── style objects ─────────────── */
const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '20px 22px',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
}
const badge = {
  fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  padding: '3px 10px', borderRadius: 99,
  background: 'linear-gradient(135deg,rgba(252,175,69,0.15),rgba(225,48,108,0.12),rgba(131,58,180,0.1))',
  border: '1px solid rgba(225,48,108,0.25)', color: '#E1306C',
}
const errorBanner = {
  background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.28)',
  color: '#ff5050', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.87rem',
}
const dropzone = {
  border: '2px dashed rgba(225,48,108,0.35)', borderRadius: 18, padding: '50px 24px',
  textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', transition: 'all 0.2s',
}
const dropzoneDrag = {
  border: '2px dashed #E1306C',
  background: 'linear-gradient(135deg,rgba(252,175,69,0.06),rgba(225,48,108,0.06))',
}
const igGradBtn = {
  display: 'inline-block', padding: '10px 28px', borderRadius: 25,
  background: 'linear-gradient(135deg,#FCAF45,#E1306C 55%,#833AB4)',
  color: '#fff', fontWeight: 700, fontSize: '0.87rem', boxShadow: '0 4px 18px rgba(225,48,108,0.3)',
}
const thumbStyle = { width: 90, height: 90, objectFit: 'cover', borderRadius: 10, display: 'block' }
const removeBtn = {
  position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%',
  background: '#E1306C', color: '#fff', border: 'none', cursor: 'pointer',
  fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const microLabel = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }
const analyseBtn = {
  marginTop: 18, width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#FCAF45 0%,#F56040 35%,#E1306C 65%,#833AB4 100%)',
  color: '#fff', fontWeight: 800, fontSize: '0.94rem', cursor: 'pointer',
  boxShadow: '0 4px 18px rgba(225,48,108,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'opacity 0.2s',
}
const analyseBtnDisabled = { background: 'var(--surface2)', color: 'var(--text-muted)', boxShadow: 'none', cursor: 'default' }
const ghostBtn = {
  background: 'transparent', border: '1px solid var(--border)', borderRadius: 9,
  color: 'var(--text-faint)', padding: '9px 16px', fontSize: '0.84rem', cursor: 'pointer',
  width: '100%', transition: 'border-color 0.15s',
}

// studio
const studioGrid = {
  display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap',
}
const studioLeft = {
  flex: '0 0 200px', position: 'sticky', top: 80,
}
const studioRight = {
  flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12,
}
const phoneFrame = {
  width: 180, height: 320, background: '#111', borderRadius: 26, padding: 7,
  boxShadow: '0 16px 48px rgba(0,0,0,0.45)', border: '2px solid #333', margin: '0 auto',
}
const phoneScreen = {
  width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', background: '#000', position: 'relative',
}
const phoneMedia = { width: '100%', height: '100%', objectFit: 'cover' }
const captionOverlay = {
  position: 'absolute', left: 0, right: 0, padding: '5px 8px', background: 'rgba(0,0,0,0.38)',
}
const captionOverlayText = {
  fontSize: '0.57rem', fontWeight: 700, textAlign: 'center', margin: 0, lineHeight: 1.38,
  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
}
const songBadge = {
  position: 'absolute', bottom: 7, left: 6, right: 6,
  background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '3px 6px',
  fontSize: '0.52rem', color: '#fff', textAlign: 'center',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

// caption cards
const captionCard = {
  border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
}
const captionCardActive = {
  borderColor: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 8%,transparent)',
}
const captionBadge = {
  fontSize: '0.67rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4,
}
const captionText = { margin: 0, fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.5 }

// song cards
const songCard = {
  display: 'flex', alignItems: 'center', gap: 10,
  border: '1px solid var(--border)', borderRadius: 10, padding: '10px 11px', transition: 'border-color 0.15s',
}
const songCardActive = {
  borderColor: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 7%,transparent)',
}
const songArtWrap = {
  width: 44, height: 44, borderRadius: 8, overflow: 'hidden', position: 'relative',
  flexShrink: 0, cursor: 'pointer', background: 'var(--surface2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const songArtFallback = { fontSize: '1.2rem', color: 'var(--text-faint)' }
const playOverlay = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '1rem', color: '#fff',
}
const songTitle  = { fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const songArtist = { fontSize: '0.76rem', color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const progressBar  = { height: 3, background: 'var(--surface2)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }
const progressFill = { height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.2s' }
const previewPill = { fontSize: '0.64rem', color: 'var(--text-faint)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 6px' }
const useBtn = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '5px 11px', fontSize: '0.77rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s',
}
const useBtnActive = { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }

// filter chips
const chipRow = { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 2 }
const chipBtn = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '5px 12px', fontSize: '0.79rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s',
}
const chipBtnActive = { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }

// render btn
const renderBtn = {
  width: '100%', padding: '14px', borderRadius: 13, border: 'none',
  background: 'linear-gradient(135deg,#FCAF45 0%,#F56040 35%,#E1306C 65%,#833AB4 100%)',
  color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
  boxShadow: '0 4px 18px rgba(225,48,108,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'opacity 0.2s',
}
const renderBtnDisabled = { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' }
