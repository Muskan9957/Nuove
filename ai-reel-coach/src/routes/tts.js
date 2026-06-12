const express = require('express')
const axios   = require('axios')
const router  = express.Router()
const { protect: auth } = require('../middleware/auth')

// ─── ElevenLabs TTS ───────────────────────────────────────────────
// "Adam" — built-in premade voice, available on ALL ElevenLabs plans
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'

router.post('/', auth, async (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'TTS_NOT_CONFIGURED' })

  try {
    const resp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text: text.slice(0, 2500),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability:        0.50,
          similarity_boost: 0.75,
          style:            0.35,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          'xi-api-key':   apiKey,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg',
        },
        responseType: 'arraybuffer',
      }
    )

    res.set('Content-Type',  'audio/mpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(Buffer.from(resp.data))
  } catch (err) {
    const msg = err.response?.data?.toString() || err.message
    console.error('[TTS] ElevenLabs error:', msg)
    res.status(err.response?.status || 500).json({ error: 'TTS request failed' })
  }
})

module.exports = router
