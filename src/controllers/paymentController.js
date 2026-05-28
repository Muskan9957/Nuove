const prisma          = require('../config/prisma');
const razorpayService = require('../services/razorpayService');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── POST /api/payments/checkout ─────────────────────────────────
// Creates a Razorpay subscription → returns { subscriptionId, keyId }
// Frontend uses these to open the Razorpay checkout modal
const checkout = async (req, res, next) => {
  try {
    const { plan, billing = 'monthly' } = req.body;
    if (!['PRO', 'STUDIO'].includes(plan)) {
      return res.status(400).json({ error: 'Plan must be PRO or STUDIO.' });
    }
    if (!['monthly', 'annual'].includes(billing)) {
      return res.status(400).json({ error: 'Billing must be monthly or annual.' });
    }

    if (!razorpayService.isConfigured()) {
      return res.status(503).json({ error: 'Payments not configured yet.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const subscription = await razorpayService.createSubscription({ user, plan, billing });

    return res.json({
      subscriptionId: subscription.id,
      keyId         : process.env.RAZORPAY_KEY_ID,
      plan,
      billing,
      userEmail     : user.email,
      userName      : user.name || '',
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/verify ───────────────────────────────────
// Called by frontend after Razorpay checkout modal succeeds
// Verifies payment signature → upgrades user plan in DB
const verify = async (req, res, next) => {
  try {
    const { paymentId, subscriptionId, signature, plan, billing = 'monthly' } = req.body;

    if (!paymentId || !subscriptionId || !signature) {
      return res.status(400).json({ error: 'Missing payment details.' });
    }

    const valid = razorpayService.verifyPaymentSignature({ paymentId, subscriptionId, signature });
    if (!valid) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    const upgradedPlan = plan || 'PRO';
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data : {
        plan            : upgradedPlan,
        stripeSubId     : subscriptionId,  // stores Razorpay subscription ID
        stripeCustomerId: paymentId,        // stores latest Razorpay payment ID
      },
      select: {
        id: true, email: true, name: true, plan: true,
        generationsUsed: true, createdAt: true, avatar: true,
        language: true, onboarded: true, streak: true,
      },
    });

    console.log(`✅ Payment verified: User ${req.user.id} → ${upgradedPlan} (${billing})`);
    return res.json({ success: true, plan: upgradedPlan, user });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/payments/subscription ─────────────────────────────
// Returns current subscription details + payment history
const subscription = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { plan: true, stripeSubId: true, stripeCustomerId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // No paid subscription
    if (!user.stripeSubId || user.plan === 'FREE') {
      return res.json({ plan: 'FREE', subscription: null, payments: [] });
    }

    // Fetch live subscription + payment history from Razorpay
    const [sub, payments] = await Promise.all([
      razorpayService.getSubscription(user.stripeSubId),
      razorpayService.listSubscriptionPayments(user.stripeSubId),
    ]);

    return res.json({
      plan        : user.plan,
      subscription: sub ? {
        id            : sub.id,
        status        : sub.status,
        currentStart  : sub.current_start,
        currentEnd    : sub.current_end,
        chargeAt      : sub.charge_at,
        cancelledAt   : sub.cancelled_at,
        endedAt       : sub.ended_at,
        totalCount    : sub.total_count,
        paidCount     : sub.paid_count,
      } : null,
      payments: payments.map(p => ({
        id         : p.id,
        amount     : p.amount / 100,           // paise → rupees
        currency   : p.currency,
        status     : p.status,
        createdAt  : p.created_at,
        description: p.description,
        method     : p.method,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/cancel ───────────────────────────────────
// Cancels the user's active Razorpay subscription (at cycle end)
const cancel = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { plan: true, stripeSubId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!user.stripeSubId || user.plan === 'FREE') {
      return res.status(400).json({ error: 'No active subscription to cancel.' });
    }

    // Cancel at end of current billing cycle (user keeps access until then)
    await razorpayService.cancelSubscription(user.stripeSubId, true);

    // We don't downgrade immediately — webhook (subscription.completed) handles it
    console.log(`⬇️  Cancellation requested: User ${req.user.id} (sub: ${user.stripeSubId})`);
    return res.json({ success: true, message: 'Subscription will be cancelled at the end of your current billing period.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/portal ───────────────────────────────────
// Razorpay has no hosted billing portal — send user to profile page
const portal = async (req, res) => {
  return res.json({ portalUrl: `${BASE_URL}/profile` });
};

// ─── POST /api/payments/webhook ──────────────────────────────────
// Razorpay calls this URL — keeps DB in sync with subscription events
const webhook = async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!razorpayService.verifyWebhookSignature(req.body, signature)) {
    console.error('Razorpay webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  try {
    switch (event.event) {

      // ── Subscription activated (payment confirmed) ────────────
      case 'subscription.activated':
      case 'subscription.charged': {
        const sub    = event.payload?.subscription?.entity;
        const userId = sub?.notes?.userId;
        const plan   = sub?.notes?.plan || 'PRO';
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data : { plan, stripeSubId: sub.id },
          });
          console.log(`✅ Subscription ${event.event}: User ${userId} → ${plan}`);
        }
        break;
      }

      // ── Subscription cancelled or expired ─────────────────────
      case 'subscription.cancelled':
      case 'subscription.completed': {
        const sub  = event.payload?.subscription?.entity;
        const user = sub?.id
          ? await prisma.user.findFirst({ where: { stripeSubId: sub.id } })
          : null;
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data : { plan: 'FREE', stripeSubId: null },
          });
          console.log(`⬇️  Subscription ended: User ${user.id} → FREE`);
        }
        break;
      }
    }

    return res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { checkout, verify, subscription, cancel, portal, webhook };
