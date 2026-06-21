const express = require('express')
const { EdgeTTS } = require('node-edge-tts')
const fs      = require('fs').promises
const os      = require('os')
const path    = require('path')
const router  = express.Router()
const { protect: auth } = require('../middleware/auth')

router.post('/', auth, async (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })

  // ─── Try Premium Microsoft Edge Neural TTS (100% Free) ───
  try {
    const voiceId = process.env.EDGE_VOICE_ID || 'en-IN-NeerjaNeural'
    const tts = new EdgeTTS({ 
      voice: voiceId, 
      lang: voiceId.substring(0, 5),
      rate: '+10%' // +10% speed boost as requested
    })
    
    const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`)
    await tts.ttsPromise(text.slice(0, 2500), tmpFile)
    
    const buffer = await fs.readFile(tmpFile)
    await fs.unlink(tmpFile).catch(() => {}) // silently clean up
    
    res.set('Content-Type', 'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    return res.send(buffer)
  } catch (err) {
    console.error('[TTS] Edge Neural failed:', err.message)
    res.status(500).json({ error: 'TTS request failed' })
  }
})

module.exports = router
