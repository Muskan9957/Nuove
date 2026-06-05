const prisma = require('../config/prisma');

const LIMITS = {
  FREE   : 10,
  STARTER: 50,
  PRO    : Infinity,
};

// Accounts with unlimited generations (for internal testing)
const TEST_EMAILS = new Set([
  'muskanmun123@gmail.com',
]);

/**
 * Checks if a user can make an AI generation.
 * Resets their counter if the calendar month has rolled over.
 * Returns { allowed: boolean, used: number, limit: number }
 */
const checkGenerationLimit = async (userId) => {
  const user = await prisma.user.findUnique({
    where : { id: userId },
    select: { email: true, plan: true, generationsUsed: true, generationsReset: true },
  });

  // Test accounts get unlimited generations
  if (user && TEST_EMAILS.has(user.email)) {
    return { allowed: true, used: user.generationsUsed, limit: Infinity };
  }

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
