import { useState, useRef } from 'react'
import { drawCameraFrame } from '../utils/cameraDraw'

const BUILD_STAMP = 'camtest-v2-instrumentation'

export default function CamTest() {
  const [lines, setLines] = useState([])
  const [running, setRunning] = useState(false)
  const [outUrl, setOutUrl] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const videoRef = useRef(null)

  const log = (s) => setLines(l => [...l, typeof s === 'object' ? JSON.stringify(s, null, 2) : s])

  const run = async () => {
    setRunning(true); setLines([]); setOutUrl(null); setVerdict(null)
    try {
      log(BUILD_STAMP)
      log(`--- WINDOW METADATA ---`)
      log(`window.innerWidth: ${window.innerWidth}`)
      log(`window.innerHeight: ${window.innerHeight}`)
      log(`devicePixelRatio: ${window.devicePixelRatio}`)
      log(`screen.orientation?.type: ${window.screen?.orientation?.type || 'unknown'}`)
      
      const portrait = window.innerWidth < 768
      const res = portrait
        ? { width: { ideal: 1080 }, height: { ideal: 1920 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } }
      
      log(`\n--- GETUSERMEDIA CONSTRAINTS ---`)
      log(JSON.stringify(res))

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'user' }, ...res, frameRate: { ideal: 30 } }, audio: false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...res, frameRate: { ideal: 30 } }, audio: false })
      }
      
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      // Wait for dimensions to settle
      await new Promise(r => setTimeout(r, 1000))
      
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      let capabilities = {}
      try {
        capabilities = track.getCapabilities ? track.getCapabilities() : 'Not supported'
      } catch (e) {
        capabilities = 'Error getting capabilities'
      }

      log(`\n--- TRACK METADATA ---`)
      log(`facingMode: ${settings.facingMode || 'unknown'}`)
      log(`aspectRatio (settings): ${settings.aspectRatio}`)
      log(`settings:`)
      log(settings)
      log(`capabilities:`)
      log(capabilities)

      log(`\n--- VIDEO ELEMENT METADATA ---`)
      const vw = video.videoWidth
      const vh = video.videoHeight
      log(`video.videoWidth: ${vw}`)
      log(`video.videoHeight: ${vh}`)
      log(`Calculated Aspect Ratio (vw/vh): ${(vw / vh).toFixed(4)}`)
      log(`Orientation: ${vw > vh ? 'LANDSCAPE (vw > vh)' : 'PORTRAIT (vw <= vh)'}`)

      const CW = 1080, CH = 1920
      const canvas = document.createElement('canvas')
      canvas.width = CW; canvas.height = CH
      const ctx = canvas.getContext('2d')
      
      log(`\n--- CANVAS METADATA ---`)
      log(`canvas.width: ${canvas.width}`)
      log(`canvas.height: ${canvas.height}`)

      const timer = setInterval(() => drawCameraFrame(ctx, video, CW, CH, { mirror: true }), 33)

      const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
      const mime = MIMES.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m))
      const rec = mime ? new MediaRecorder(canvas.captureStream(30), { mimeType: mime }) : new MediaRecorder(canvas.captureStream(30))
      
      const chunks = []
      rec.ondataavailable = e => e.data.size && chunks.push(e.data)
      const stopped = new Promise(r => (rec.onstop = r))
      rec.start(200)
      log('\nrecording 2.5s…')
      await new Promise(r => setTimeout(r, 2500))
      rec.stop()
      await stopped
      clearInterval(timer)
      stream.getTracks().forEach(t => t.stop())

      const blob = new Blob(chunks, { type: mime || 'video/webm' })
      const out = document.createElement('video')
      out.muted = true
      out.src = URL.createObjectURL(blob)
      await Promise.race([
        new Promise(r => out.addEventListener('loadedmetadata', r, { once: true })),
        new Promise((_, j) => setTimeout(() => j(new Error('metadata timeout')), 7000)),
      ])
      
      setOutUrl(out.src)
      setVerdict(out.videoHeight > out.videoWidth
        ? '✅ VERTICAL — pipeline is correct on this device'
        : '❌ HORIZONTAL — pipeline broken on this device')
    } catch (e) {
      log('ERROR: ' + (e && e.message))
      setVerdict('❌ TEST FAILED')
    }
    setRunning(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c14', color: '#eee', padding: '24px 16px', fontFamily: 'monospace' }}>
      <h2 style={{ marginTop: 0 }}>📹 Recorder diagnostic</h2>
      <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Tests your real camera through the real recording pipeline. Nothing is uploaded.</p>
      <button
        onClick={run}
        disabled={running}
        style={{ padding: '14px 26px', fontSize: '1rem', fontWeight: 700, borderRadius: 12, border: 'none', background: '#E1306C', color: '#fff', marginBottom: '20px' }}
      >
        {running ? 'Running…' : '▶ Run camera test'}
      </button>

      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 4 }}>live camera</div>
          <video ref={videoRef} muted playsInline style={{ width: 130, background: '#000', borderRadius: 8 }} />
        </div>
        {outUrl && (
          <div>
            <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 4 }}>recorded result</div>
            <video src={outUrl} muted playsInline controls loop style={{ width: 130, background: '#000', borderRadius: 8 }} />
          </div>
        )}
      </div>

      {verdict && (
        <div style={{ padding: 14, borderRadius: 10, fontWeight: 700, fontSize: '1rem', background: verdict.startsWith('✅') ? 'rgba(0,180,80,0.15)' : 'rgba(255,50,50,0.15)' }}>
          {verdict}
        </div>
      )}

      <pre style={{ marginTop: 16, fontSize: '0.7rem', whiteSpace: 'pre-wrap', background: '#15151f', padding: 12, borderRadius: 10, overflowX: 'auto' }}>
        {lines.join('\n') || 'Tap the button to start.'}
      </pre>
    </div>
  )
}
