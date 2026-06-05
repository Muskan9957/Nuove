const { validationResult } = require('express-validator');
const prisma    = require('../config/prisma');
const aiService = require('../services/aiService');
const { checkAndAwardBadges, updateStreak } = require('../services/badgeService');

// ─── POST /api/performance/analyze ───────────────────────────────
const analyze = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { topic, hookUsed, views, watchTimePercent, likes, shares, comments, language } = req.body;

    // Fetch past logs for personalization context (last 5 posts)
    const pastLogs = await prisma.performanceLog.findMany({
      where  : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take   : 5,
      select : { topic: true, views: true, watchTimePercent: true },
    });

    // Generate AI feedback
    const feedback = await aiService.analyzePerformance({
      topic, hookUsed, views, watchTimePercent, likes, shares, comments, pastLogs, language,
    });

    // Save to database (builds Creator Learning Profile over time)
    const log = await prisma.performanceLog.create({
      data: {
        userId          : req.user.id,
        topic,
        hookUsed,
        views,
        watchTimePercent,
        likes,
        shares,
        comments,
        feedback,
      },
    });

    // Update streak and check for new badges
    const newStreak = await updateStreak(req.user.id);
    const newBadges = await checkAndAwardBadges(req.user.id);

    const response = {
      message : 'Performance analyzed!',
      analysis: {
        id      : log.id,
        topic,
        feedback,
        loggedAt: log.createdAt,
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

// ─── GET /api/performance/history ────────────────────────────────
const history = async (req, res, next) => {
  try {
    const logs = await prisma.performanceLog.findMany({
      where  : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select : {
        id              : true,
        topic           : true,
        views           : true,
        watchTimePercent: true,
        likes           : true,
        shares          : true,
        comments        : true,
        createdAt       : true,
      },
    });
    return res.json({ logs });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/performance/history/:id ────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const log = await prisma.performanceLog.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!log) return res.status(404).json({ error: 'Log not found.' });
    return res.json({ log });
  } catch (err) {
    next(err);
  }
};

module.exports = { analyze, history, getOne };
