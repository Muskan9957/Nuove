const prisma = require('../config/prisma');

const LIMITS = {
  FREE  : 5,       // 5 scripts/month
  PRO   : Infinity, // unlimited
  STUDIO: Infinity, // unlimited + priority AI
};

/**
 * Checks if a user can make an AI generation.
 * Resets their counter if the calendar month has rolled over.
 * Returns { allowed: boolean, used: number, limit: number }
 */
const checkGenerationLimit = async (userId) => {
  const user = await prisma.user.findUnique({
    where : { id: userId },
    select: { plan: true, generationsUsed: true, generationsReset: true },
  });

  if (!user) throw new Error('User not found');

  const now   = new Date();
  const reset = new Date(user.generationsReset);
  const limit = LIMITS[user.plan];

  // Reset counter at the start of a new month
  if (now.getMonth() !== reset.getMonth() || now.getFullYear() !== reset.getFullYear()) {
    await prisma.user.update({
      where: { id: userId },
      data : { generationsUsed: 0, generationsReset: now },
    });
    return { allowed: true, used: 0, limit };
  }

  const allowed = user.generationsUsed < limit;
  return { allowed, used: user.generationsUsed, limit };
};

/**
 * Increments the generation counter after a successful generation.
 */
const incrementGenerations = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data : { generationsUsed: { increment: 1 } },
  });
};

module.exports = { checkGenerationLimit, incrementGenerations };
