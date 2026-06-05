const aiService = require('../services/aiService');
const { updateStreak, checkAndAwardBadges } = require('../services/badgeService');

// ─── POST /api/captions/generate ──────────────────────────────────
const generate = async (req, res, next) => {
  try {
    const { topic, niche, tone, language } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const result = await aiService.generateCaptions({
      topic   : topic.trim(),
      niche   : niche    ? niche.trim()    : undefined,
      tone    : tone     ? tone.trim()     : undefined,
      language: language || 'en',
    });

    // Update user streak on successful generation and check badges
    const [newStreak, newBadges] = await Promise.all([
      updateStreak(req.user.id).catch(() => 0),
      checkAndAwardBadges(req.user.id).catch(() => []),
    ]);

    const response = {
      message : 'Captions generated successfully!',
      topic,
      captions: result.captions,
      hashtags: result.hashtags,
      newStreak,
    };
    if (newBadges.length > 0) response.newBadges = newBadges;

    return res.json(response);
  } catch (err) {
    next(err);
  }
};

module.exports = { generate };
