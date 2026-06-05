const router     = require('express').Router()
const axios      = require('axios')
const { protect: auth } = require('../middleware/auth')
const { getProfile, updateLanguage, getBadges, pingStreak } = require('../controllers/userController')
const prisma     = require('../config/prisma')
const aiService  = require('../services/aiService')

router.get('/profile',      auth, getProfile)
router.patch('/language',   auth, updateLanguage)
router.get('/badges',       auth, getBadges)
router.post('/streak/ping', auth, pingStreak)

// ─── Creator Voice (premium personalisation) ──────────────────────

// GET /api/user/voice — return saved style profile
router.get('/voice', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { plan: true, creatorStyle: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const profile = user.creatorStyle ? JSON.parse(user.creatorStyle) : null
    return res.json({ plan: user.plan, profile })
  } catch (err) { next(err) }
})

// POST /api/user/voice — analyse samples and save voice profile
router.post('/voice', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { plan: true },
    })
    // Gate to STARTER+ — FREE users see the feature but can't save
    if (!user || user.plan === 'FREE') {
      return res.status(403).json({
        error  : 'Creator Voice is a premium feature.',
        upgrade: 'Upgrade to Starter or Pro to unlock your personal voice profile.',
      })
    }

    const { samples } = req.body   // array of 1-3 strings
    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ error: 'Provide at least one content sample.' })
    }
    const filtered = samples.map(s => String(s).trim()).filter(s => s.length > 20)
    if (filtered.length === 0) {
      return res.status(400).json({ error: 'Samples are too short. Paste real captions or scripts.' })
    }

    const profile = await aiService.analyzeCreatorStyle(filtered)
    if (!profile) return res.status(502).json({ error: 'Style analysis failed. Please try again.' })

    const toSave = { ...profile, updatedAt: new Date().toISOString(), sampleCount: filtered.length }
    await prisma.user.update({
      where: { id: req.user.id },
      data : { creatorStyle: JSON.stringify(toSave) },
    })

    return res.json({ profile: toSave })
  } catch (err) { next(err) }
})

// DELETE /api/user/voice — clear the saved profile
router.delete('/voice', auth, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data : { creatorStyle: null },
    })
    return res.json({ ok: true })
  } catch (err) { next(err) }
})

router.patch('/onboarded', auth, async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { onboarded: true } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ─── POST /api/user/generate-avatar ───────────────────────────────
const AVATAR_STYLES = {
  cyberpunk:   'cyberpunk neon city warrior, glowing blue and purple circuits, futuristic helmet visor, high tech aesthetic',
  anime:       'anime character portrait, vibrant expressive eyes, clean line art, Studio Ghibli inspired, soft pastel tones',
  fantasy:     'epic fantasy character, mystical aura, glowing runes, ethereal light, painterly digital art',
  neon:        'bold neon portrait, vibrant electric colors, dark background, synthwave aesthetic, glowing outlines',
  minimal:     'minimalist geometric avatar, clean shapes, flat design, modern and professional',
  cosmic:      'cosmic space explorer, galaxy background, stars and nebula, deep blues and purples, cinematic',
  pixel:       'pixel art character avatar, retro 16-bit style, colorful, game sprite aesthetic',
  watercolor:  'watercolor painted portrait, soft brushstrokes, dreamy artistic style, pastel colors',
}

router.post('/generate-avatar', auth, async (req, res, next) => {
  try {
    const { style = 'cyberpunk' } = req.body

    const STYLE_MAP = {
      cyberpunk:   'bottts',
      anime:       'adventurer',
      fantasy:     'personas',
      neon:        'rings',
      minimal:     'shapes',
      cosmic:      'identicon',
      pixel:       'pixel-art',
      watercolor:  'lorelei',
    }

    const dicebearStyle = STYLE_MAP[style] || 'bottts'
    const seed = Math.random().toString(36).substring(2, 12)
    const imageUrl = `https://api.dicebear.com/8.x/${dicebearStyle}/png?seed=${seed}&size=256`

    res.json({ url: imageUrl })
  } catch (err) {
    console.error('Avatar error:', err.message)
    res.status(502).json({ error: 'Avatar generation failed.' })
  }
})

// ─── PATCH /api/user/avatar ────────────────────────────────────────
router.patch('/avatar', auth, async (req, res, next) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'url is required' })
    await prisma.user.update({ where: { id: req.user.id }, data: { avatar: url } })
    res.json({ ok: true, avatar: url })
  } catch (err) { next(err) }
})

module.exports = router
