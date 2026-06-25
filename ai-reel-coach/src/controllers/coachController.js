const prisma    = require('../config/prisma');
const aiService = require('../services/aiService');
const planService = require('../services/planService');
const { updateStreak } = require('../services/badgeService');

const titleFrom = (msg) => {
  const t = (msg || '').trim().replace(/\s+/g, ' ');
  return t.length > 48 ? t.slice(0, 48).trim() + '…' : (t || 'New chat');
};

// ─── POST /api/coach/chat ─────────────────────────────────────────
const chat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { message, history, context, language, conversationId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    message = message.trim();

    // Build userContext from DB (in parallel)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [user, scriptsCount, hookScores, recentScripts] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { streak: true, plan: true } }),
      prisma.script.count({ where: { userId } }),
      prisma.hookScore.findMany({ where: { userId }, select: { score: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.script.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { topic: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
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
      onboardingContext: context || '',
    };

    // Resolve the conversation (verify ownership) or create a new one titled
    // from the first message.
    let conversation = null;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    }
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { userId, title: titleFrom(message) } });
    }

    // Save the user message
    await prisma.chatMessage.create({
      data: { userId, conversationId: conversation.id, role: 'user', content: message },
    });

    const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];

    const [{ reply }, newStreak] = await Promise.all([
      aiService.coachChat({ message, history: trimmedHistory, userContext, language: language || 'en' }),
      updateStreak(userId),
    ]);

    await prisma.chatMessage.create({
      data: { userId, conversationId: conversation.id, role: 'assistant', content: reply },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    planService.incrementFeature(userId, 'coach').catch(() => {});

    return res.json({ reply, newStreak, conversationId: conversation.id, title: conversation.title });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/coach/conversations ─────────────────────────────────
const listConversations = async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where  : { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take   : 50,
      select : { id: true, title: true, updatedAt: true },
    });
    return res.json({ conversations });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/coach/conversations/:id ─────────────────────────────
const getConversation = async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where : { id: req.params.id, userId: req.user.id },
      select: { id: true, title: true },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const messages = await prisma.chatMessage.findMany({
      where  : { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select : { id: true, role: true, content: true, createdAt: true },
    });
    return res.json({ conversation, messages });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/coach/conversations/:id ──────────────────────────
const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    await prisma.conversation.delete({ where: { id: conversation.id } }); // cascades messages
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { chat, listConversations, getConversation, deleteConversation };
