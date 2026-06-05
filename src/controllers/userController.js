const prisma = require('../config/prisma')
const { updateStreak, checkAndAwardBadges } = require('../services/badgeService')

const VALID_LANGUAGES = ['en', 'hi', 'es', 'fr', 'pt']

// ─── GET /api/user/profile ────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where  : { id: req.user.id },
      select : {
        id              : true,
        email           : true,
        name            : true,
        avatar          : true,
        plan            : true,
        streak          : true,
        lastActiveDate  : true,
        language        : true,
        generationsUsed : true,
        generationsReset: true,
        createdAt       : true,
        badges          : {
          select : { id: true, type: true, earnedAt: true },
          orderBy: { earnedAt: 'desc' },
        },
      },
    })

    if (!user) return res.status(404).json({ error: 'User not found.' })

    return res.json({ user })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/user/language ─────────────────────────────────────
const updateLanguage = async (req, res, next) => {
  try {
    const { language } = req.body

    if (!language || !VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({
        error: `language must be one of: ${VALID_LANGUAGES.join(', ')}`,
      })
    }

    const user = await prisma.user.update({
      where : { id: req.user.id },
      data  : { language },
      select: { id: true, language: true },
    })

    return res.json({ message: 'Language updated.', language: user.language })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/user/badges ─────────────────────────────────────────
const getBadges = async (req, res, next) => {
  try {
    const badges = await prisma.badge.findMany({
      where  : { userId: req.user.id },
      orderBy: { earnedAt: 'desc' },
    })

    return res.json({ badges })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/user/streak/ping ───────────────────────────────────
const pingStreak = async (req, res, next) => {
  try {
    const newStreak = await updateStreak(req.user.id)
    const newBadges = await checkAndAwardBadges(req.user.id)
    return res.json({ newStreak, newBadges })
  } catch (err) {
    next(err)
  }
}

module.exports = { getProfile, updateLanguage, getBadges, pingStreak }
