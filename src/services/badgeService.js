const prisma = require('../config/prisma')

const BADGE_RULES = {
  FIRST_SCRIPT: async (userId) => {
    const count = await prisma.script.count({ where: { userId } })
    return count >= 1
  },
  SCRIPTS_10: async (userId) => {
    const count = await prisma.script.count({ where: { userId } })
    return count >= 10
  },
  SCRIPTS_50: async (userId) => {
    const count = await prisma.script.count({ where: { userId } })
    return count >= 50
  },
  PERFECT_HOOK: async (userId) => {
    const score = await prisma.hookScore.findFirst({ where: { userId, score: { gte: 90 } } })
    return !!score
  },
  ANALYZER_5: async (userId) => {
    const count = await prisma.performanceLog.count({ where: { userId } })
    return count >= 5
  },
  STREAK_7: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    return user.streak >= 7
  },
  STREAK_30: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    return user.streak >= 30
  },
}

// Check and award any newly earned badges. Returns array of newly awarded badge types.
const checkAndAwardBadges = async (userId) => {
  const existing = await prisma.badge.findMany({ where: { userId }, select: { type: true } })
  const existingTypes = new Set(existing.map(b => b.type))
  const newlyAwarded = []

  for (const [type, check] of Object.entries(BADGE_RULES)) {
    if (existingTypes.has(type)) continue
    try {
      const earned = await check(userId)
      if (earned) {
        await prisma.badge.create({ data: { userId, type } })
        newlyAwarded.push(type)
      }
    } catch {}
  }
  return newlyAwarded
}

// Update streak: call this whenever user does any action
const updateStreak = async (userId) => {
  const today = new Date().toISOString().slice(0, 10)
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (user.lastActiveDate === today) return user.streak // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const newStreak = user.lastActiveDate === yesterday ? user.streak + 1 : 1

  await prisma.user.update({
    where: { id: userId },
    data: { streak: newStreak, lastActiveDate: today },
  })
  return newStreak
}

module.exports = { checkAndAwardBadges, updateStreak }
