const aiService = require('../services/aiService');
const planService = require('../services/planService');
const { updateStreak } = require('../services/badgeService');

// ─── POST /api/captions/generate ──────────────────────────────────
const generate = async (req, res, next) => {
  try {
    const { topic, niche, tone, language } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const [result, newStreak] = await Promise.all([
      aiService.generateCaptions({
        topic   : topic.trim(),
        niche   : niche    ? niche.trim()    : undefined,
        tone    : tone     ? tone.trim()     : undefined,
        language: language || 'en',
      }),
      updateStreak(req.user.id)
    ]);

    planService.incrementFeature(req.user.id, 'captions').catch(() => {});

    return res.json({
      message : 'Captions generated successfully!',
      topic,
      captions: result.captions,
      hashtags: result.hashtags,
      newStreak,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { generate };
