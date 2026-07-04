import { useState, useRef } from 'react'
import { drawCameraFrame } from '../utils/cameraDraw'

// On-device recorder diagnostic — /cam-test (no login needed).
// Runs the user's REAL camera through the REAL recording pipeline
// (drawCameraFrame -> 9:16 canvas -> MediaRecorder) and prints a verdict.
// Exists because this can only be truly verified on a physical phone.
const BUILD_STAMP = 'camtest-v1 · ' + (typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev')

export default function CamTest() {
  const [lines, setLines] = useState([])
  const [running, setRunning] = useState(false)
  const [outUrl, setOutUrl] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const videoRef = useRef(null)

  const log = (s) => setLines(l => [...l, s])

  const run = async () => {
    setRunning(true); setLines([]); setOutUrl(null); setVerdict(null)
    try {
      log(BUILD_STAMP)
      log(`screen: ${window.innerWidth}x${window.innerHeight} (${window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'})`)

      // 1. Same constraints as the recorder
      const portrait = window.innerWidth < 768
      const res = portrait
        ? { width: { ideal: 1080 }, height: { ideal: 1920 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } }
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'user' }, ...res, frameRate: { ideal: 30 } }, audio: false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...res, frameRate: { ideal: 30 } }, audio: false })
      }
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      await new Promise(r => setTimeout(r, 500))
      const vw = video.videoWidth, vh = video.videoHeight
      log(`camera stream: ${vw}x${vh} → ${vw > vh ? 'LANDSCAPE (needs rotation)' : 'PORTRAIT (no rotation)'}`)

      // 2. Real pipeline: 9:16 canvas + shared draw routine
      const CW = 1080, CH = 1920
      const canvas = document.createElement('canvas')
      canvas.width = CW; canvas.height = CH
      const ctx = canvas.getContext('2d')
      const timer = setInterval(() => drawCameraFrame(ctx, video, CW, CH, { mirror: true }), 33)

      // 3. Record with tolerant MIME list (works on iOS + Android)
      const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
      const mime = MIMES.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m))
      log(`recorder mime: ${mime || '(browser default)'}`)
      const rec = mime ? new MediaRecorder(canvas.captureStream(30), { mimeType: mime }) : new MediaRecorder(canvas.captureStream(30))
      const chunks = []
      rec.ondataavailable = e => e.data.size && chunks.push(e.data)
      const stopped = new Promise(r => (rec.onstop = r))
      rec.start(200)
      log('recording 2.5s…')
      await new Promise(r => setTimeout(r, 2500))
      rec.stop()
      await stopped
      clearInterval(timer)
      stream.getTracks().forEach(t => t.stop())

      // 4. Verdict from the actual recorded blob
      const blob = new Blob(chunks, { type: mime || 'video/webm' })
      log(`recorded blob: ${(blob.size / 1024).toFixed(0)} KB`)
      const out = document.createElement('video')
      out.muted = true
      out.src = URL.createObjectURL(blob)
      await Promise.race([
        new Promise(r => out.addEventListener('loadedmetadata', r, { once: true })),
        new Promise((_, j) => setTimeout(() => j(new Error('metadata timeout')), 7000)),
      ])
      log(`recorded video: ${out.videoWidth}x${out.videoHeight}`)
      setOutUrl(out.src)
      setVerdict(out.videoHeight > out.videoWidth
        ? '✅ VERTICAL — pipeline is correct on this device'
        : '❌ HORIZONTAL — pipeline broken on this device')
    } catch (e) {
      log('ERROR: ' + (e && e.message))
      setVerdict('❌ TEST FAILED — see error above')
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
        style={{ padding: '14px 26px', fontSize: '1rem', fontWeight: 700, borderRadius: 12, border: 'none', background: '#E1306C', color: '#fff' }}
      >
        {running ? 'Running…' : '▶ Run camera test'}
      </button>

      {verdict && (
        <div style={{ marginTop: 18, padding: 14, borderRadius: 10, fontWeight: 700, fontSize: '1rem', background: verdict.startsWith('✅') ? 'rgba(0,180,80,0.15)' : 'rgba(255,50,50,0.15)' }}>
          {verdict}
        </div>
      )}

      <pre style={{ marginTop: 16, fontSize: '0.78rem', whiteSpace: 'pre-wrap', background: '#15151f', padding: 12, borderRadius: 10 }}>
        {lines.join('\n') || 'Tap the button to start.'}
      </pre>

      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
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
    </div>
  )
}
