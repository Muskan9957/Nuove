const prisma    = require('../config/prisma');
const aiService = require('../services/aiService');
const { updateStreak } = require('../services/badgeService');

// ─── POST /api/remix/generate ─────────────────────────────────────
const generate = async (req, res, next) => {
  try {
    const { hook, body, cta, topic, scriptId, language } = req.body;

    if (!hook || !hook.trim()) {
      return res.status(400).json({ error: 'hook is required' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'body is required' });
    }
    if (!cta || !cta.trim()) {
      return res.status(400).json({ error: 'cta is required' });
    }

    // If scriptId provided, verify it belongs to this user
    if (scriptId) {
      const script = await prisma.script.findFirst({
        where: { id: scriptId, userId: req.user.id },
      });
      if (!script) {
        return res.status(404).json({ error: 'Script not found.' });
      }
    }

    const [result, newStreak] = await Promise.all([
      aiService.remixContent({
        hook    : hook.trim(),
        body    : body.trim(),
        cta     : cta.trim(),
        topic   : topic ? topic.trim() : hook.trim(),
        language: language || 'en',
      }),
      updateStreak(req.user.id)
    ]);

    return res.json({
      message : 'Content remixed successfully!',
      twitter : result.twitter,
      linkedin: result.linkedin,
      youtube : result.youtube,
      caption : result.caption,
      newStreak,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { generate };
