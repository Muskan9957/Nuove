const express    = require('express');
const { protect }   = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const controller = require('../controllers/reelReadyController');

const router = express.Router();
router.use(protect);

// POST /api/reel-ready/analyze
// Body: { frames: string[], mediaTypes: string[], audience: string, language: string }
router.post('/analyze', aiLimiter, controller.analyze);

// POST /api/reel-ready/more-captions
// Body: { contentUnderstanding, topic, niche, tone, mood, audience, language }
router.post('/more-captions', aiLimiter, controller.moreCaptions);

// GET /api/reel-ready/audio?url=ENCODED_PREVIEW_URL
// Proxies iTunes 30s preview audio to bypass CORS for AudioContext
router.get('/audio', controller.proxyAudio);

module.exports = router;
