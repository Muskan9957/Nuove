const express = require('express')
const axios   = require('axios')
const { EdgeTTS } = require('node-edge-tts')
const fs      = require('fs').promises
const os      = require('os')
const path    = require('path')
const router  = express.Router()

// ─── Google Translate TTS ─────────────────────────────────────────
// Free, no API key, proxied server-side so CORS is never an issue.
// Splits text at sentence boundaries to stay under Google's 200-char limit.
function splitSentences(text, maxLen = 180) {
  const raw = text.match(/[^.!?\n]+[.!?\n]*/g) || [text]
  const chunks = []
  let cur = ''
  for (const s of raw) {
    const t = s.trim()
    if (!t) continue
    if (cur && (cur + ' ' + t).length > maxLen) { chunks.push(cur); cur = t.slice(0, maxLen) }
    else cur = cur ? cur + ' ' + t : t
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.filter(c => c.length > 0)
}

// Google Translate language codes
const LANG_MAP = {
  'en-IN': 'en', 'hi-IN': 'hi', 'es-ES': 'es', 'fr-FR': 'fr',
  'pt-BR': 'pt', 'de-DE': 'de', 'ar-SA': 'ar', 'id-ID': 'id',
  'ja-JP': 'ja', 'ko-KR': 'ko',
}

router.post('/', async (req, res) => {
  const { text, lang = 'en-IN' } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })

  const textToSpeak = text.slice(0, 1500)

  // ─── 1. Try Premium Microsoft Edge Neural TTS (100% Free) ─────────────────
  try {
    const voiceId = process.env.EDGE_VOICE_ID || 'en-IN-NeerjaNeural'
    const tts = new EdgeTTS({ 
      voice: voiceId, 
      lang: voiceId.substring(0, 5),
      rate: '+10%'
    })
    
    const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`)
    await tts.ttsPromise(textToSpeak, tmpFile)
    
    const buffer = await fs.readFile(tmpFile)
    await fs.unlink(tmpFile).catch(() => {}) // silently clean up
    
    res.set('Content-Type', 'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=3600')
    return res.send(buffer)
  } catch (err) {
    console.warn('[TTS] Edge Neural failed, falling back to Google:', err.message)
  }

  // ─── 2. Fallback to Free Google Translate TTS ────────────────────────────
  const tl     = LANG_MAP[lang] || 'en'
  const chunks = splitSentences(textToSpeak)

  try {
    const buffers = []
    for (const chunk of chunks) {
      const resp = await axios.get('https://translate.google.com/translate_tts', {
        params: {
          ie: 'UTF-8', q: chunk, tl,
          client: 'tw-ob', ttsspeed: '1',
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer':    'https://translate.google.com/',
          'Accept':     'audio/mpeg, audio/*',
        },
        responseType: 'arraybuffer',
        timeout: 8000,
      })
      buffers.push(Buffer.from(resp.data))
    }

    const buffer = Buffer.concat(buffers)
    res.set('Content-Type',  'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(buffer)
  } catch (err) {
    const status = err.response?.status
    console.error('[TTS] Google error:', status, err.message)
    res.status(500).json({ error: `TTS failed ${status || ''}: ${err.message}` })
  }
})

module.exports = router
