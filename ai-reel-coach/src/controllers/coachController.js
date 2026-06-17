const prisma    = require('../config/prisma');
const aiService = require('../services/aiService');
const planService = require('../services/planService');
const { updateStreak } = require('../services/badgeService');

// ─── POST /api/coach/chat ─────────────────────────────────────────
const chat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { message, history, context, language } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Build userContext from DB (do in parallel)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [user, scriptsCount, hookScores, recentScripts] = await Promise.all([
      prisma.user.findUnique({
        where : { id: userId },
        select: { streak: true, plan: true },
      }),
      prisma.script.count({ where: { userId } }),
      prisma.hookScore.findMany({
        where  : { userId },
        select : { score: true },
        orderBy: { createdAt: 'desc' },
        take   : 20,
      }),
      prisma.script.findMany({
        where  : { userId, createdAt: { gte: thirtyDaysAgo } },
        select : { topic: true },
        orderBy: { createdAt: 'desc' },
        take   : 5,
      }),
    ]);

    let avgHookScore = 0;
    if (hookScores.length > 0) {
      avgHookScore = Math.round(hookScores.reduce((a, h) => a + h.score, 0) / hookScores.length);
    }

    const userContext = {
      scriptsCount,
      avgHookScore,
      streak      : user?.streak || 0,
      plan        : user?.plan   || 'FREE',
      recentTopics: recentScripts.map(s => s.topic),
      onboardingContext: context || '', // niches + goals + platform from onboarding
    };

    // Save user message to DB
    await prisma.chatMessage.create({
      data: { userId, role: 'user', content: message.trim() },
    });

    // Trim history to last 10 messages
    const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];

    // Get AI reply and update streak
    const [ { reply }, newStreak ] = await Promise.all([
      aiService.coachChat({
        message    : message.trim(),
        history    : trimmedHistory,
        userContext,
        language   : language || 'en',
      }),
      updateStreak(userId)
    ]);

    // Save assistant message to DB
    await prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: reply },
    });

    planService.incrementFeature(userId, 'coach').catch(() => {});

    return res.json({ reply, newStreak });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/coach/history ───────────────────────────────────────
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const messages = await prisma.chatMessage.findMany({
      where  : { userId },
      orderBy: { createdAt: 'desc' },
      take   : 20,
      select : {
        id       : true,
        role     : true,
        content  : true,
        createdAt: true,
      },
    });

    // Return in chronological order (oldest first)
    return res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/coach/history (save message) ───────────────────────
const saveMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { role, content } = req.body;

    if (!role || !['user', 'assistant'].includes(role)) {
      return res.status(400).json({ error: 'role must be "user" or "assistant"' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const message = await prisma.chatMessage.create({
      data: { userId, role, content: content.trim() },
    });

    return res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
};

module.exports = { chat, getHistory, saveMessage };
