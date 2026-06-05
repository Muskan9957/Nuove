const { validationResult } = require('express-validator');
const prisma      = require('../config/prisma');
const aiService   = require('../services/aiService');
const { checkAndAwardBadges, updateStreak } = require('../services/badgeService');

// ─── POST /api/hooks/score ────────────────────────────────────────
const score = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { hookText, scriptId, language } = req.body;

    // Score via AI
    const result = await aiService.scoreHook(hookText, language);

    // Save record
    const hookScore = await prisma.hookScore.create({
      data: {
        userId  : req.user.id,
        scriptId: scriptId || null,
        hookText,
        score   : result.score,
        grade   : result.grade,
        status  : result.status,
        reasons : JSON.stringify(result.reasons),
      },
    });

    // Update streak and check for new badges (PERFECT_HOOK badge among others)
    const newStreak = await updateStreak(req.user.id);
    const newBadges = await checkAndAwardBadges(req.user.id);

    const response = {
      message  : 'Hook scored successfully!',
      hookScore: {
        id      : hookScore.id,
        hookText,
        score   : result.score,
        grade   : result.grade,
        status  : result.status,
        reasons : result.reasons,
      },
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

// ─── POST /api/hooks/rewrite ──────────────────────────────────────
const rewrite = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { scriptId, originalHook, language } = req.body;

    // Verify script belongs to this user
    const script = await prisma.script.findFirst({
      where: { id: scriptId, userId: req.user.id },
    });
    if (!script) return res.status(404).json({ error: 'Script not found.' });

    const originalScore = script.hookScore || 50;

    // Rewrite via AI
    const { rewrittenHook, changes } = await aiService.rewriteHook(originalHook, originalScore, language);

    // Score the new hook
    const newScoreData = await aiService.scoreHook(rewrittenHook, language);

    // Save rewrite record
    const rewriteRecord = await prisma.rewrite.create({
      data: {
        scriptId,
        originalHook,
        rewrittenHook,
        originalScore,
        newScore: newScoreData.score,
        changes,
      },
    });

    return res.status(201).json({
      message: 'Hook rewritten successfully!',
      rewrite: {
        id           : rewriteRecord.id,
        originalHook,
        rewrittenHook,
        originalScore,
        newScore     : newScoreData.score,
        improvement  : newScoreData.score - originalScore,
        newGrade     : newScoreData.grade,
        newStatus    : newScoreData.status,
        changes,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/hooks/rewrite/accept ──────────────────────────────
const acceptRewrite = async (req, res, next) => {
  try {
    const { rewriteId } = req.body;

    const rewrite = await prisma.rewrite.findFirst({
      where  : { id: rewriteId },
      include: { script: true },
    });

    if (!rewrite) return res.status(404).json({ error: 'Rewrite not found.' });
    if (rewrite.script.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    // Mark rewrite accepted and update the script's hook
    await Promise.all([
      prisma.rewrite.update({ where: { id: rewriteId }, data: { accepted: true } }),
      prisma.script.update({
        where: { id: rewrite.scriptId },
        data : { hook: rewrite.rewrittenHook, hookScore: rewrite.newScore },
      }),
    ]);

    return res.json({ message: 'Rewrite accepted. Script updated!' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/hooks/history ───────────────────────────────────────
const history = async (req, res, next) => {
  try {
    const rows = await prisma.hookScore.findMany({
      where  : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take   : 20,
    });
    // Parse reasons back from JSON string
    const hookScores = rows.map(r => ({ ...r, reasons: JSON.parse(r.reasons) }));
    return res.json({ hookScores });
  } catch (err) {
    next(err);
  }
};

module.exports = { score, rewrite, acceptRewrite, history };
