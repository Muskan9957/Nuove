const express    = require('express');
const { body }   = require('express-validator');
const controller = require('../controllers/authController');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  apiLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('name').optional().trim().isLength({ max: 60 }),
  ],
  controller.register
);

// POST /api/auth/login
router.post(
  '/login',
  apiLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  controller.login
);

// GET /api/auth/me  (protected)
const { protect } = require('../middleware/auth');
router.get('/me', protect, controller.getMe);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  apiLimiter,
  [body('email').isEmail().withMessage('Please enter a valid email.')],
  controller.forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
  apiLimiter,
  [
    body('token').notEmpty().withMessage('Token is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  controller.resetPassword
);

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', controller.verifyEmail);

module.exports = router;
