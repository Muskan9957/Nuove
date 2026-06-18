const prisma = require('../config/prisma');

const LIMITS = {
  FREE  : 10,       // 10 scripts/month
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

// ─── Per-feature monthly limits (FREE tier) ──────────────────────────
// PRO/STUDIO are unlimited. Matches the pricing page.
const FEATURE_LIMITS = {
  captions: { FREE: 10, PRO: Infinity, STUDIO: Infinity },
  coach:    { FREE: 10, PRO: Infinity, STUDIO: Infinity },
  remix:    { FREE: 5,  PRO: Infinity, STUDIO: Infinity },
};

/**
 * Generic per-feature limit check (captions/coach/remix).
 * Resets the per-feature counter when the calendar month rolls over.
 * Returns { allowed, used, limit }.
 */
const checkFeatureLimit = async (userId, feature) => {
  const conf = FEATURE_LIMITS[feature];
  if (!conf) return { allowed: true, used: 0, limit: Infinity };

  const user = await prisma.user.findUnique({
    where : { id: userId },
    select: { plan: true },
  });
  if (!user) throw new Error('User not found');

  const limit = conf[user.plan] ?? Infinity;
  if (limit === Infinity) return { allowed: true, used: 0, limit };

  const counter = await prisma.usageCounter.findUnique({
    where : { userId_feature: { userId, feature } },
  });
  if (!counter) return { allowed: true, used: 0, limit };

  // Monthly reset
  const now   = new Date();
  const reset = new Date(counter.periodStart);
  if (now.getMonth() !== reset.getMonth() || now.getFullYear() !== reset.getFullYear()) {
    await prisma.usageCounter.update({
      where: { id: counter.id },
      data : { count: 0, periodStart: now },
    });
    return { allowed: true, used: 0, limit };
  }

  return { allowed: counter.count < limit, used: counter.count, limit };
};

/**
 * Increment a feature counter after a successful generation.
 */
const incrementFeature = async (userId, feature) => {
  if (!FEATURE_LIMITS[feature]) return;
  await prisma.usageCounter.upsert({
    where : { userId_feature: { userId, feature } },
    create: { userId, feature, count: 1, periodStart: new Date() },
    update: { count: { increment: 1 } },
  });
};

module.exports = { checkGenerationLimit, incrementGenerations, checkFeatureLimit, incrementFeature, FEATURE_LIMITS };
