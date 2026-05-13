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
  { id: 'center', label: 'Middle' },
  { id: 'bottom', label: 'Bottom' },
]

const CAPTION_COLORS = [
  { id: 'white',  label: 'White',  fill: '#ffffff', stroke: '#000000' },
  { id: 'yellow', label: 'Yellow', fill: '#FFE600', stroke: '#000000' },
  { id: 'black',  label: 'Black',  fill: '#111111', stroke: '#ffffff' },
  { id: 'pink',   label: 'Pink',   fill: '#FF6EC7', stroke: '#000000' },
]

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
        return { ...song, previewUrl: hit?.previewUrl || null, artworkUrl: hit?.artworkUrl60?.replace('60x60', '100x100') || null }
      } catch { return song }
    })
  )
}

/* ─────────────────── render engine ─────────────────────── */
function drawWrappedCaption(ctx, text, position, colorObj, W, H) {
  const maxW    = W - 80
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
  const padX = 32, padY = 18
  const boxW = maxW + padX * 2

  let baseY
  if (position === 'top')         baseY = 160
  else if (position === 'center') baseY = (H - totalH) / 2
  else                            baseY = H - 180 - totalH

  ctx.fillStyle = 'rgba(0,0,0,0.48)'
  const boxH = totalH + padY * 2
  ctx.beginPath()
  ctx.roundRect((W - boxW) / 2, baseY - padY, boxW, boxH, 20)
  ctx.fill()

  ctx.fillStyle   = colorObj.fill
  ctx.strokeStyle = colorObj.stroke
  ctx.lineWidth   = 3
  lines.forEach((ln, i) => {
    const y = baseY + i * lineH + fontSize
    ctx.strokeText(ln, W / 2, y)
    ctx.fillText(ln,   W / 2, y)
  })
}

function cropDraw(ctx, source, W, H, sW, sH) {
  const ta = W / H
  let sx = 0, sy = 0, sw = sW, sh = sH
  if (sW / sH > ta) { sw = sH * ta; sx = (sW - sw) / 2 }
  else              { sh = sW / ta; sy = (sH - sh) / 2 }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, W, H)
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

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const destNode = audioCtx.createMediaStreamDestination()
  let audioBuf   = null

  if (selectedSong?.previewUrl) {
    try {
      const proxied = `${apiBase}/api/reel-ready/audio?url=${encodeURIComponent(selectedSong.previewUrl)}`
      const resp    = await fetch(proxied)
      const arrBuf  = await resp.arrayBuffer()
      audioBuf      = await audioCtx.decodeAudioData(arrBuf)
    } catch (e) { console.warn('Audio proxy failed:', e) }
  }

  const MIMES = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm']
  const mime  = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
  const ext   = mime.includes('mp4') ? 'mp4' : 'webm'

  if (isVideo) {
    const vid = document.createElement('video')
    vid.src = objectUrl; vid.muted = true; vid.playsInline = true; vid.crossOrigin = 'anonymous'
    await new Promise(r => vid.addEventListener('loadeddata', r, { once: true }))
    const dur = Math.min(vid.duration, 30)

    const stream = canvas.captureStream(30)
    if (audioBuf) { const s = audioCtx.createBufferSource(); s.buffer = audioBuf; s.connect(destNode); s.start(0) }
    destNode.stream.getAudioTracks().forEach(t => stream.addTrack(t))

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
    const chunks = []
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    rec.start(100); vid.play()

    let fid
    const draw = () => {
      ctx.filter = filterCss
      cropDraw(ctx, vid, W, H, vid.videoWidth, vid.videoHeight)
      ctx.filter = 'none'
      if (selectedCaption) drawWrappedCaption(ctx, selectedCaption, captionPosition, capColor, W, H)
      fid = requestAnimationFrame(draw)
    }
    draw()
    await new Promise(r => setTimeout(r, dur * 1000))
    cancelAnimationFrame(fid); vid.pause(); rec.stop()
    await new Promise(r => { rec.onstop = r })
    audioCtx.close(); URL.revokeObjectURL(objectUrl)
    return { blob: new Blob(chunks, { type: mime }), ext }
  }

  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = objectUrl
  await new Promise(r => { img.onload = r })
  ctx.filter = filterCss
  cropDraw(ctx, img, W, H, img.naturalWidth, img.naturalHeight)
  ctx.filter = 'none'
  if (selectedCaption) drawWrappedCaption(ctx, selectedCaption, captionPosition, capColor, W, H)

  const stream = canvas.captureStream(30)
  if (audioBuf) { const s = audioCtx.createBufferSource(); s.buffer = audioBuf; s.connect(destNode); s.start(0) }
  destNode.stream.getAudioTracks().forEach(t => stream.addTrack(t))

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 })
  const chunks = []
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  rec.start(100)
  await new Promise(r => setTimeout(r, 10_000))
  rec.stop(); await new Promise(r => { rec.onstop = r })
  audioCtx.close(); URL.revokeObjectURL(objectUrl)
  return { blob: new Blob(chunks, { type: mime }), ext }
}

/* ══════════════════════════════════════════════════════════════ */
export default function ReelReady() {
  const toast = useToast()

  const [step,      setStep]      = useState(0)  // 0=upload, 1=analysing, 2=studio, 3=rendering, 4=done
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [fileType,  setFileType]  = useState(null)
  const [dragging,  setDragging]  = useState(false)
  const fileInputRef = useRef(null)

  const [audience]               = useState(getSavedRegion() || 'India')
  const [language,  setLanguage]  = useState('en')

  const [analysis,  setAnalysis]  = useState(null)
  const [songs,     setSongs]     = useState([])
  const [captions,  setCaptions]  = useState([])

  // studio
  const [selectedCaption, setSelectedCaption] = useState('')
  const [selectedSong,    setSelectedSong]    = useState(null)
  const [filter,          setFilter]          = useState('original')
  const [captionPos,      setCaptionPos]      = useState('bottom')
  const [captionColor,    setCaptionColor]    = useState('white')
  const [captionLoading,  setCaptionLoading]  = useState(false)

  // audio
  const [playingKey,    setPlayingKey]    = useState(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const audioRef    = useRef(null)
  const progressRef = useRef(null)

  // render / output
  const [renderPct,  setRenderPct]  = useState(0)
  const [outputBlob, setOutputBlob] = useState(null)
  const [outputExt,  setOutputExt]  = useState('webm')
  const [error,      setError]      = useState('')

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null }
    setPlayingKey(null); setAudioProgress(0)
  }, [])

  useEffect(() => () => stopAudio(), [stopAudio])

  /* ── file ── */
  const handleFile = useCallback((f) => {
    if (!f) return
    const isVid = f.type.startsWith('video/'), isImg = f.type.startsWith('image/')
    if (!isVid && !isImg) { toast('Please upload an image or video file', 'error'); return }
    if (f.size > 150 * 1024 * 1024) { toast('File too large — max 150 MB', 'error'); return }
    setFile(f); setFileType(isVid ? 'video' : 'image')
    setPreview(URL.createObjectURL(f))
    setStep(0); setAnalysis(null); setOutputBlob(null); setError('')
    stopAudio()
  }, [toast, stopAudio])

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }

  /* ── analyse ── */
  const analyse = async () => {
    if (!file) return
    setStep(1); setError(''); stopAudio()
    try {
      let frames, mediaTypes
      if (fileType === 'video') {
        frames = await extractVideoFrames(file, 4); mediaTypes = frames.map(() => 'image/jpeg')
      } else {
        frames = [await readFileAsBase64(file)]; mediaTypes = [file.type]
      }
      const { analysis: an, songs: raw } = await api.reelReady({ frames, mediaTypes, audience, language })
      const enriched = await enrichWithiTunes(raw || [], audience)
      setAnalysis(an)
      setCaptions(an.captions || [])
      setSongs(enriched)
      setSelectedCaption(an.captions?.[0]?.text || '')
      setSelectedSong(null)
      setStep(2)
    } catch (e) {
      setError(e.message || 'Analysis failed. Please try again.'); setStep(0)
      toast(e.message || 'Analysis failed', 'error')
    }
  }

  /* ── more captions ── */
  const moreCaptions = async () => {
    if (!analysis) return
    setCaptionLoading(true)
    try {
      const { captions: fresh } = await api.reelMoreCaptions({
        contentUnderstanding: analysis.contentUnderstanding,
        topic: analysis.topic, niche: analysis.niche, tone: analysis.tone, mood: analysis.mood, audience, language,
      })
      setCaptions(fresh); setSelectedCaption(fresh[0]?.text || '')
    } catch (e) { toast(e.message || 'Could not generate captions', 'error') }
    finally { setCaptionLoading(false) }
  }

  /* ── audio ── */
  const togglePlay = (song) => {
    const key = song.title + song.artist
    if (playingKey === key) { stopAudio(); return }
    stopAudio()
    if (!song.previewUrl) return
    const audio = new Audio(song.previewUrl)
    audio.play().catch(() => {})
    audioRef.current = audio; setPlayingKey(key); setAudioProgress(0)
    audio.onended = stopAudio
    progressRef.current = setInterval(() => {
      if (!audioRef.current) return
      const pct = (audioRef.current.currentTime / (audioRef.current.duration || 30)) * 100
      setAudioProgress(isNaN(pct) ? 0 : pct)
    }, 200)
  }

  /* ── render ── */
  const render = async () => {
    if (!file) return
    setStep(3); setRenderPct(0); setError(''); stopAudio()
    const tick = setInterval(() => setRenderPct(p => Math.min(p + 2, 92)), 600)
    try {
      const apiBase = import.meta.env.VITE_API_URL || ''
      const { blob, ext } = await renderReel({
        mediaFile: file, mediaType: file.type, selectedSong, selectedCaption,
        filter, captionPosition: captionPos, captionColor, apiBase,
      })
      clearInterval(tick); setRenderPct(100); setOutputBlob(blob); setOutputExt(ext); setStep(4)
    } catch (e) {
      clearInterval(tick); setError('Render failed: ' + (e.message || 'unknown')); setStep(2)
      toast('Render failed: ' + (e.message || 'unknown'), 'error')
    }
  }

  const download = () => {
    if (!outputBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(outputBlob); a.download = `reel-ready.${outputExt}`; a.click()
  }

  const activeFilter = FILTERS.find(f => f.id === filter) || FILTERS[0]

  /* ─── RENDER ─── */
  return (
    <div className="page-enter" style={{ maxWidth: 980, margin: '0 auto', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Reel Ready</h1>
          <span style={S.badge}>New</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55, maxWidth: 520, margin: 0 }}>
          Upload a photo or video → pick your caption, song &amp; style → download a post-ready reel.
        </p>
      </div>

      <StepBar step={step} />

      {error && <div style={S.errorBanner}>{error}</div>}

      {/* ── STEP 0/1: Upload ── */}
      {(step === 0 || step === 1) && (
        <div style={S.card}>
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ ...S.dropzone, ...(dragging ? S.dropzoneDrag : {}) }}
            >
              <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>📲</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: 6 }}>Drop your photo or video here</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 18 }}>or click to browse · JPG, PNG, MP4, MOV · up to 150 MB</div>
              <span style={S.igBtn}>Choose File</span>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {fileType === 'image'
                  ? <img src={preview} alt="" style={S.thumb} />
                  : <video src={preview} muted style={S.thumb} />}
                <button onClick={() => { setFile(null); setPreview(null); setFileType(null) }} style={S.removeBtn}>✕</button>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: 2 }}>{file.name}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-faint)' }}>
                  {fileType === 'video' ? '🎥' : '🖼'} {(file.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            </div>
          )}

          {file && (
            <button onClick={analyse} disabled={step === 1} style={{ ...S.analyseBtn, ...(step === 1 ? S.analyseBtnOff : {}) }}>
              {step === 1
                ? <><span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--text-muted)' }} /> Analysing…</>
                : <>✦ Analyse &amp; Build Reel</>}
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2: Studio ── */}
      {step === 2 && analysis && (
        <div style={S.studio}>

          {/* ── LEFT: phone + edit controls ── */}
          <div style={S.leftCol}>

            {/* Phone preview */}
            <div style={S.phoneFrame}>
              <div style={S.phoneScreen}>
                {preview && (fileType === 'video'
                  ? <video src={preview} style={{ ...S.phoneMedia, filter: activeFilter.css }} muted playsInline autoPlay loop />
                  : <img   src={preview} alt="" style={{ ...S.phoneMedia, filter: activeFilter.css }} />
                )}
                {selectedCaption && (
                  <div style={{ ...S.captionBar, ...captionBarPos(captionPos) }}>
                    <p style={{ ...S.captionBarText, color: CAPTION_COLORS.find(c => c.id === captionColor)?.fill || '#fff' }}>
                      {selectedCaption}
                    </p>
                  </div>
                )}
                {selectedSong && (
                  <div style={S.songBadge}>🎵 {selectedSong.title}</div>
                )}
              </div>
            </div>

            {/* ── Edit controls directly under phone ── */}
            <div style={S.editPanel}>

              {/* Filters */}
              <div style={S.editGroup}>
                <div style={S.editLabel}>Filter</div>
                <div style={S.editChips}>
                  {FILTERS.map(f => (
                    <button key={f.id} style={{ ...S.chip, ...(filter === f.id ? S.chipOn : {}) }} onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption position */}
              <div style={S.editGroup}>
                <div style={S.editLabel}>Caption position</div>
                <div style={S.editChips}>
                  {CAPTION_POSITIONS.map(p => (
                    <button key={p.id} style={{ ...S.chip, ...(captionPos === p.id ? S.chipOn : {}) }} onClick={() => setCaptionPos(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption color */}
              <div style={S.editGroup}>
                <div style={S.editLabel}>Caption color</div>
                <div style={S.editChips}>
                  {CAPTION_COLORS.map(c => (
                    <button
                      key={c.id} title={c.label}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c.fill, border: captionColor === c.id ? '2px solid var(--accent)' : '2px solid var(--border)', cursor: 'pointer', outline: captionColor === c.id ? '3px solid var(--accent)' : 'none', outlineOffset: 2, flexShrink: 0 }}
                      onClick={() => setCaptionColor(c.id)}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT: captions + songs + hashtags ── */}
          <div style={S.rightCol}>

            {/* Captions */}
            <div style={S.section}>
              <div style={S.sectionHead}>
                <span style={S.sectionTitle}>Caption</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="select"
                    style={{ fontSize: '0.76rem', padding: '4px 8px', borderRadius: 7 }}
                  >
                    {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  <button style={S.moreBtn} onClick={moreCaptions} disabled={captionLoading}>
                    {captionLoading ? '⏳' : '✦ More'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {captions.map((c, i) => (
                  <div
                    key={i}
                    style={{ ...S.captionOption, ...(selectedCaption === c.text ? S.captionOptionOn : {}) }}
                    onClick={() => setSelectedCaption(c.text)}
                  >
                    {c.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Songs */}
            <div style={S.section}>
              <div style={S.sectionHead}>
                <span style={S.sectionTitle}>Music</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>Tap artwork to preview</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {songs.map((song, i) => {
                  const key     = song.title + song.artist
                  const playing = playingKey === key
                  const chosen  = selectedSong?.title === song.title
                  return (
                    <div key={i} style={{ ...S.songRow, ...(chosen ? S.songRowOn : {}) }}>
                      <div style={S.artWrap} onClick={() => togglePlay(song)}>
                        {song.artworkUrl
                          ? <img src={song.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                          : <div style={{ fontSize: '1.1rem', color: 'var(--text-faint)' }}>♪</div>
                        }
                        <div style={S.playOverlay}>{playing ? '⏸' : '▶'}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.songName}>{song.title}</div>
                        <div style={S.songArtist}>{song.artist}</div>
                        {playing && (
                          <div style={S.progBar}>
                            <div style={{ ...S.progFill, width: `${audioProgress}%` }} />
                          </div>
                        )}
                      </div>
                      <button
                        style={{ ...S.useBtn, ...(chosen ? S.useBtnOn : {}) }}
                        onClick={() => setSelectedSong(chosen ? null : song)}
                      >
                        {chosen ? '✓' : 'Use'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hashtags */}
            {analysis.hashtags && (
              <div style={S.section}>
                <div style={S.sectionHead}>
                  <span style={S.sectionTitle}>Hashtags</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.79rem', color: 'var(--text-faint)', lineHeight: 1.85, wordBreak: 'break-word' }}>
                  {[...(analysis.hashtags.niche || []), ...(analysis.hashtags.broad || []), ...(analysis.hashtags.trending || [])].join(' ')}
                </p>
              </div>
            )}

            <button onClick={render} style={S.renderBtn}>
              🎬 Render &amp; Export
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Rendering ── */}
      {step === 3 && (
        <div style={{ ...S.card, alignItems: 'center', textAlign: 'center', padding: 48, gap: 16 }}>
          <div style={{ fontSize: '2.4rem' }}>🎬</div>
          <h2 style={{ margin: 0, fontWeight: 800, color: 'var(--text)' }}>Rendering your reel…</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.87rem' }}>Keep this tab open. Takes 10–30 seconds.</p>
          <div style={{ width: '100%', maxWidth: 340, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#FCAF45,#E1306C)', borderRadius: 3, width: `${renderPct}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-faint)' }}>{renderPct}%</p>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 4 && outputBlob && (
        <div style={{ ...S.card, alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: '2.8rem' }}>🎉</div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.35rem', color: 'var(--text)' }}>Your Reel is Ready!</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.87rem', maxWidth: 380 }}>
            Music, caption and style are baked in. Download and post directly.
          </p>
          <video src={URL.createObjectURL(outputBlob)} controls style={{ width: '100%', maxWidth: 340, maxHeight: 460, borderRadius: 12, background: '#000', objectFit: 'contain' }} />
          <button style={S.renderBtn} onClick={download}>⬇ Download (.{outputExt.toUpperCase()})</button>
          {analysis?.hashtags && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', width: '100%', textAlign: 'left' }}>
              <div style={{ ...S.microLabel, marginBottom: 6 }}>Hashtags — copy and paste</div>
              <p style={{ margin: 0, fontSize: '0.79rem', color: 'var(--text)', lineHeight: 1.85, wordBreak: 'break-word' }}>
                {[...(analysis.hashtags.niche || []), ...(analysis.hashtags.broad || []), ...(analysis.hashtags.trending || [])].join(' ')}
              </p>
            </div>
          )}
          <button style={S.ghostBtn} onClick={() => { setStep(0); setFile(null); setPreview(null); setOutputBlob(null); setAnalysis(null); setSongs([]); setCaptions([]) }}>
            ← Start Over
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ─── helpers ─── */
function StepBar({ step }) {
  const labels = ['Upload', 'Analyse', 'Studio', 'Done']
  const active  = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 2 : 3
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
      {labels.map((s, i) => {
        const done = i < active, on = i === active
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--accent)' : done ? 'color-mix(in srgb,var(--accent) 20%,transparent)' : 'var(--surface2)', color: on ? '#fff' : done ? 'var(--accent)' : 'var(--text-faint)' }}>
              {done ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: on || done ? 'var(--accent)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>{s}</span>
            {i < 3 && <div style={{ width: 32, height: 2, background: done ? 'var(--accent)' : 'var(--border)', margin: '0 4px' }} />}
          </div>
        )
      })}
    </div>
  )
}

function captionBarPos(pos) {
  if (pos === 'top')    return { top: 20, bottom: 'auto', transform: 'none' }
  if (pos === 'center') return { top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }
  return { bottom: 20, top: 'auto', transform: 'none' }
}

/* ─── styles ─── */
const S = {
  badge: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99, background: 'linear-gradient(135deg,rgba(252,175,69,0.15),rgba(225,48,108,0.12))', border: '1px solid rgba(225,48,108,0.25)', color: '#E1306C' },
  errorBanner: { background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.28)', color: '#ff5050', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.86rem' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 0 },
  dropzone: { border: '2px dashed rgba(225,48,108,0.3)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', transition: 'all 0.2s' },
  dropzoneDrag: { border: '2px dashed #E1306C', background: 'linear-gradient(135deg,rgba(252,175,69,0.05),rgba(225,48,108,0.05))' },
  igBtn: { display: 'inline-block', padding: '10px 26px', borderRadius: 25, background: 'linear-gradient(135deg,#FCAF45,#E1306C 55%,#833AB4)', color: '#fff', fontWeight: 700, fontSize: '0.86rem', boxShadow: '0 4px 16px rgba(225,48,108,0.28)' },
  thumb: { width: 88, height: 88, objectFit: 'cover', borderRadius: 10, display: 'block' },
  removeBtn: { position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#E1306C', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  microLabel: { fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 5 },
  analyseBtn: { marginTop: 18, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#FCAF45 0%,#F56040 35%,#E1306C 65%,#833AB4 100%)', color: '#fff', fontWeight: 800, fontSize: '0.93rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(225,48,108,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  analyseBtnOff: { background: 'var(--surface2)', color: 'var(--text-muted)', boxShadow: 'none', cursor: 'default' },
  ghostBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-faint)', padding: '9px 16px', fontSize: '0.83rem', cursor: 'pointer', width: '100%' },
  renderBtn: { width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#FCAF45 0%,#F56040 35%,#E1306C 65%,#833AB4 100%)', color: '#fff', fontWeight: 800, fontSize: '0.93rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(225,48,108,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },

  // studio layout
  studio: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },

  leftCol: { flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 0, position: 'sticky', top: 72 },
  phoneFrame: { width: 196, height: 348, background: '#111', borderRadius: 28, padding: 7, boxShadow: '0 18px 50px rgba(0,0,0,0.42)', border: '2px solid #2a2a2a', margin: '0 auto' },
  phoneScreen: { width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', background: '#000', position: 'relative' },
  phoneMedia: { width: '100%', height: '100%', objectFit: 'cover' },
  captionBar: { position: 'absolute', left: 0, right: 0, padding: '5px 7px', background: 'rgba(0,0,0,0.38)' },
  captionBarText: { fontSize: '0.55rem', fontWeight: 700, textAlign: 'center', margin: 0, lineHeight: 1.35, textShadow: '0 1px 3px rgba(0,0,0,0.9)' },
  songBadge: { position: 'absolute', bottom: 6, left: 5, right: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '3px 5px', fontSize: '0.5rem', color: '#fff', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // edit panel — sits directly under phone, same width
  editPanel: { width: 196, margin: '10px auto 0', display: 'flex', flexDirection: 'column', gap: 10 },
  editGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  editLabel: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' },
  editChips: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: { padding: '4px 9px', borderRadius: 6, fontSize: '0.73rem', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s' },
  chipOn: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },

  // right col
  rightCol: { flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 },
  section: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontWeight: 700, fontSize: '0.93rem', color: 'var(--text)' },
  moreBtn: { fontSize: '0.76rem', fontWeight: 600, padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-faint)', cursor: 'pointer' },

  // caption options — plain, no label badge
  captionOption: { fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.55, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' },
  captionOptionOn: { borderColor: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 8%,transparent)' },

  // song rows
  songRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 9, transition: 'border-color 0.15s' },
  songRowOn: { borderColor: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 7%,transparent)' },
  artWrap: { width: 42, height: 42, borderRadius: 8, flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  playOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#fff' },
  songName: { fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  songArtist: { fontSize: '0.75rem', color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  progBar: { height: 3, background: 'var(--surface2)', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  progFill: { height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.2s' },
  useBtn: { padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' },
  useBtnOn: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
}
