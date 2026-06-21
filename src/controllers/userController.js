const prisma = require('../config/prisma')
const { updateStreak } = require('../services/badgeService');

const VALID_LANGUAGES = ['en', 'hi', 'es', 'fr', 'pt']

const getCurrentStreak = (user) => {
  if (!user || !user.lastActiveDate || !user.streak) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (user.lastActiveDate === today || user.lastActiveDate === yesterday) {
    return user.streak;
  }
  return 0;
};

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

    user.streak = getCurrentStreak(user);

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

// ─── POST /api/user/streak/ping ─────────────────────────────────────
const pingStreak = async (req, res, next) => {
  try {
    const newStreak = await updateStreak(req.user.id);
    return res.json({ newStreak });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateLanguage, getBadges, pingStreak }
