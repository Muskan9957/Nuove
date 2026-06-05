const { validationResult } = require('express-validator');
const prisma         = require('../config/prisma');
const aiService      = require('../services/aiService');
const planService    = require('../services/planService');
const { checkAndAwardBadges, updateStreak } = require('../services/badgeService');

// ─── POST /api/scripts/generate ──────────────────────────────────
const generate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // 1. Check plan limits
    const { allowed, used, limit } = await planService.checkGenerationLimit(req.user.id);
    if (!allowed) {
      return res.status(403).json({
        error  : `You have used all ${limit} script generations for this month.`,
        upgrade: 'Upgrade your plan to generate more scripts.',
        used, limit,
      });
    }

    // 2. Load voice profile (premium users only — null for FREE)
    const userRow = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { creatorStyle: true },
    });
    const voiceProfile = userRow?.creatorStyle ? JSON.parse(userRow.creatorStyle) : null;

    // 3. Generate script via AI (voice profile injected into prompt when present)
    const { topic, niche, tone, language, audience, duration } = req.body;
    const { hook, body, cta, fullScript } = await aiService.generateScript({ topic, niche, tone, language, audience, voiceProfile, duration });

    // 4. Viral edit + score hook + generate visual/music — all in parallel
    const [edited, hookScoreData, visualMusic] = await Promise.all([
      aiService.viralEdit({ hook, body, cta }, { language }),
      aiService.scoreHook(hook, language),
      aiService.generateVisualMusic({ topic, niche, hook, audience }),
    ]);

    // Use the viral-edited versions for everything downstream
    const finalHook = edited.hook || hook;
    const finalBody = edited.body || body;
    const finalCta  = edited.cta  || cta;

    // 5. Save script to database
    const script = await prisma.script.create({
      data: {
        userId: req.user.id,
        topic,
        niche : niche || null,
        tone  : tone  || null,
        hook  : finalHook,
        body  : finalBody,
        cta   : finalCta,
        fullScript,
        hookScore: hookScoreData.score,
      },
    });

    // 5. Save hook score record (needs script.id — can't fully parallelize with step 4)
    await prisma.hookScore.create({
      data: {
        userId  : req.user.id,
        scriptId: script.id,
        hookText: hook,
        score   : hookScoreData.score,
        grade   : hookScoreData.grade,
        status  : hookScoreData.status,
        reasons : JSON.stringify(hookScoreData.reasons),
      },
    });

    // 6 & 7. Increment usage + update streak in parallel — they don't depend on each other
    const [_, newStreak] = await Promise.all([
      planService.incrementGenerations(req.user.id),
      updateStreak(req.user.id),
    ]);
    const newBadges = await checkAndAwardBadges(req.user.id);

    const response = {
      message: 'Script generated successfully!',
      script : {
        id             : script.id,
        topic,
        hook           : finalHook,
        body           : finalBody,
        cta            : finalCta,
        fullScript,
        viralEditNote  : edited.changes || null,
        voiceUsed      : voiceProfile ? voiceProfile.summary : null,
        hookScore      : hookScoreData,
        visual         : visualMusic?.visual || null,
        music          : visualMusic?.music  || null,
      },
      usage: { used: used + 1, limit },
      newStreak,
    };

    if (newBadges.length > 0) {
      response.newBadges = newBadges;
    }

    return res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/scripts/retake ─────────────────────────────────────
// Fresh script on the same topic — does NOT consume the monthly quota.
// The 5-per-topic cap is enforced on the client; this endpoint just
// generates and scores without touching generationsUsed.
const retake = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { topic, niche, tone, language, audience, duration } = req.body;
    const { hook, body, cta, fullScript } = await aiService.generateScript({ topic, niche, tone, language, audience, duration });
    const [hookScoreData, visualMusic] = await Promise.all([
      aiService.scoreHook(hook, language),
      aiService.generateVisualMusic({ topic, niche, hook, audience }),
    ]);

    return res.json({
      script: {
        hook, body, cta, fullScript,
        hookScore    : hookScoreData,
        visual       : visualMusic?.visual || null,
        music        : visualMusic?.music  || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/scripts/refine ─────────────────────────────────────
// Iterates on an existing script without consuming the generation quota.
const refine = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { hook, body, cta, instruction, language, audience, topic } = req.body;
    const refined = await aiService.refineScript({ hook, body, cta, instruction, language, audience, topic });

    // Re-score the new hook so the UI can show grade change
    const hookScoreData = await aiService.scoreHook(refined.hook, language);

    return res.json({
      script: {
        hook     : refined.hook,
        body     : refined.body,
        cta      : refined.cta,
        fullScript: refined.fullScript,
        hookScore: hookScoreData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/scripts ─────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const scripts = await prisma.script.findMany({
      where  : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select : {
        id        : true,
        topic     : true,
        hook      : true,
        hookScore : true,
        createdAt : true,
      },
    });
    return res.json({ scripts });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/scripts/:id ─────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const script = await prisma.script.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!script) return res.status(404).json({ error: 'Script not found.' });
    return res.json({ script });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/scripts/songs ─────────────────────────────────────
const songs = async (req, res, next) => {
  try {
    const { hook, body, cta, topic, niche, tone, genre, mood, bpm, audience } = req.body;
    if (!hook || !topic) return res.status(400).json({ error: 'hook and topic are required.' });
    const result = await aiService.recommendSongs({ hook, body: body || '', cta: cta || '', topic, niche, tone, genre, mood, bpm, audience });
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { generate, retake, refine, getAll, getOne, songs };
