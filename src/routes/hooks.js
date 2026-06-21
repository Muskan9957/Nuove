const express    = require('express');
const { body }   = require('express-validator');
const controller = require('../controllers/hookController');
const { protect }   = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);

// POST /api/hooks/score — score any hook text
router.post(
  '/score',
  aiLimiter,
  [
    body('hookText').trim().notEmpty().withMessage('Hook text is required.').isLength({ max: 500 }),
    body('scriptId').optional().isString(),
  ],
  controller.score
);

// POST /api/hooks/rewrite — AI rewrites a weak hook
router.post(
  '/rewrite',
  aiLimiter,
  [
    body('scriptId').notEmpty().withMessage('scriptId is required.'),
    body('originalHook').trim().notEmpty().withMessage('Original hook text is required.'),
  ],
  controller.rewrite
);

// POST /api/hooks/rewrite/accept — user accepts a rewrite
router.post(
  '/rewrite/accept',
  [body('rewriteId').notEmpty().withMessage('rewriteId is required.')],
  controller.acceptRewrite
);

// GET /api/hooks/history
router.get('/history', controller.history);

module.exports = router;
