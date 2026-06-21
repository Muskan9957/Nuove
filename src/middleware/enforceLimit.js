const planService = require('../services/planService');

/**
 * Blocks a request when the user has hit their monthly limit for a feature.
 * Usage: router.post('/generate', protect, enforceLimit('captions'), controller.fn)
 * The controller should call planService.incrementFeature(userId, feature) on success.
 */
const enforceLimit = (feature) => async (req, res, next) => {
  try {
    const { allowed, used, limit } = await planService.checkFeatureLimit(req.user.id, feature);
    if (!allowed) {
      return res.status(403).json({
        error       : `You've used all ${limit} ${feature} for this month on the Free plan. Upgrade to Pro for unlimited.`,
        limitReached: true,
        feature, used, limit,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = enforceLimit;
