const express        = require('express');
const { body }       = require('express-validator');
const controller     = require('../controllers/paymentController');
const { protect }    = require('../middleware/auth');

const router = express.Router();

// POST /api/payments/checkout
// Creates Razorpay subscription → returns { subscriptionId, keyId }
router.post(
  '/checkout',
  protect,
  [
    body('plan').isIn(['PRO', 'STUDIO']).withMessage('Plan must be PRO or STUDIO.'),
    body('billing').optional().isIn(['monthly', 'annual']).withMessage('Billing must be monthly or annual.'),
  ],
  controller.checkout
);

// POST /api/payments/verify
// Verifies payment signature after Razorpay modal completes
router.post(
  '/verify',
  protect,
  [
    body('paymentId').notEmpty(),
    body('subscriptionId').notEmpty(),
    body('signature').notEmpty(),
  ],
  controller.verify
);

// GET /api/payments/subscription
// Returns current subscription details + payment history
router.get('/subscription', protect, controller.subscription);

// POST /api/payments/cancel
// Cancels the user's active subscription at end of billing cycle
router.post('/cancel', protect, controller.cancel);

// POST /api/payments/portal
// Returns profile URL (Razorpay has no hosted portal)
router.post('/portal', protect, controller.portal);

// POST /api/payments/webhook
// Razorpay calls this — raw body needed for signature verification
router.post('/webhook', controller.webhook);

module.exports = router;
