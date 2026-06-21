const router = require('express').Router();
const trendEngineV2 = require('../services/trendsV2/trendEngineV2');
const { protect: auth } = require('../middleware/auth');

// GET /api/trends-v2-debug?region=India&niche=general
router.get('/', auth, async (req, res, next) => {
  try {
    const region = (req.query.region || 'India').trim();
    const niche = (req.query.niche || 'general').trim();

    const trends = await trendEngineV2.getTrendsV2(region, niche);
    return res.json({
      region,
      niche,
      count: trends.length,
      trends,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;