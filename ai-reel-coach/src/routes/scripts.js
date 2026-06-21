const express    = require('express');
const { body }   = require('express-validator');
const controller = require('../controllers/scriptController');
const { protect }    = require('../middleware/auth');
const { aiLimiter }  = require('../middleware/rateLimiter');

const router = express.Router();

// All script routes require login
router.use(protect);

// GET /api/scripts/check-quota
router.get('/check-quota', controller.checkQuota);

// POST /api/scripts/save (Vercel Edge posts here after streaming)
router.post('/save', controller.save);

// POST /api/scripts/generate-stream (SSE)
router.post(
  '/generate-stream',
  aiLimiter,
  [
    body('topic').trim().notEmpty().withMessage('Topic is required.').isLength({ max: 1000 }),
    body('niche').optional().trim().isLength({ max: 100 }),
    body('tone').optional().trim().isIn(['educational', 'funny', 'motivational', 'storytelling', 'controversial', 'conversational']),
  ],
  controller.generateStream
);

// POST /api/scripts/generate
router.post(
  '/generate',
  aiLimiter,
  [
    body('topic').trim().notEmpty().withMessage('Topic is required.').isLength({ max: 200 }),
    body('niche').optional().trim().isLength({ max: 100 }),
    body('tone').optional().trim().isIn(['educational', 'funny', 'motivational', 'storytelling', 'controversial', 'conversational'])
      .withMessage('Tone must be one of: educational, funny, motivational, storytelling, controversial, conversational'),
  ],
  controller.generate
);

// POST /api/scripts/retake (free re-roll on the same topic — e.g. tone change)
router.post('/retake', aiLimiter, controller.retake);

// POST /api/scripts/refine (targeted refinement of an existing script)
router.post('/refine', aiLimiter, controller.refine);

// POST /api/scripts/songs (recommend Spotify songs for a script)
router.post('/songs', aiLimiter, controller.recommendSongs);

// GET /api/scripts
router.get('/', controller.getAll);

// GET /api/scripts/:id
router.get('/:id', controller.getOne);

module.exports = router;
