const Razorpay = require('razorpay');
const crypto   = require('crypto');

// ─── Lazy init — no crash when keys aren't set yet ───────────────
const getRzp = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id    : process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const isConfigured = () =>
  !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

// ─── Plan IDs (set in .env after creating plans in Razorpay dashboard) ──
// Create 4 plans in your Razorpay dashboard:
//   Pro Monthly  → RAZORPAY_PLAN_PRO_MONTHLY
//   Pro Annual   → RAZORPAY_PLAN_PRO_ANNUAL
//   Studio Monthly → RAZORPAY_PLAN_STUDIO_MONTHLY
//   Studio Annual  → RAZORPAY_PLAN_STUDIO_ANNUAL
const PLAN_IDS = {
  PRO_MONTHLY   : process.env.RAZORPAY_PLAN_PRO_MONTHLY   || process.env.RAZORPAY_PLAN_PRO,
  PRO_ANNUAL    : process.env.RAZORPAY_PLAN_PRO_ANNUAL    || process.env.RAZORPAY_PLAN_PRO,
  STUDIO_MONTHLY: process.env.RAZORPAY_PLAN_STUDIO_MONTHLY || process.env.RAZORPAY_PLAN_STUDIO,
  STUDIO_ANNUAL : process.env.RAZORPAY_PLAN_STUDIO_ANNUAL  || process.env.RAZORPAY_PLAN_STUDIO,
};

// ─── Create a subscription ────────────────────────────────────────
const createSubscription = async ({ user, plan, billing = 'monthly' }) => {
  const rzp    = getRzp();
  if (!rzp) throw new Error('Razorpay not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');

  const key    = `${plan}_${billing.toUpperCase()}`;   // e.g. PRO_MONTHLY
  const planId = PLAN_IDS[key];
  if (!planId) throw new Error(`Razorpay plan ID missing for "${key}" — add RAZORPAY_PLAN_${key} to .env`);

  const totalCount = billing === 'annual' ? 1 : 12;   // 1 annual charge or 12 monthly

  const subscription = await rzp.subscriptions.create({
    plan_id        : planId,
    customer_notify: 1,
    total_count    : totalCount,
    notes          : {
      userId : String(user.id),
      plan,
      billing,
      email  : user.email,
    },
  });

  return subscription;
};

// ─── Fetch a single subscription from Razorpay ───────────────────
const getSubscription = async (subscriptionId) => {
  const rzp = getRzp();
  if (!rzp || !subscriptionId) return null;
  try {
    return await rzp.subscriptions.fetch(subscriptionId);
  } catch {
    return null;
  }
};

// ─── Cancel a subscription ────────────────────────────────────────
// cancel_at_cycle_end = 1 → access until period ends (recommended)
const cancelSubscription = async (subscriptionId, atCycleEnd = true) => {
  const rzp = getRzp();
  if (!rzp) throw new Error('Razorpay not configured.');
  return await rzp.subscriptions.cancel(subscriptionId, atCycleEnd ? 1 : 0);
};

// ─── List payments for a subscription ────────────────────────────
const listSubscriptionPayments = async (subscriptionId) => {
  const rzp = getRzp();
  if (!rzp || !subscriptionId) return [];
  try {
    const result = await rzp.payments.all({
      subscription_id: subscriptionId,
      count          : 10,
    });
    return result?.items || [];
  } catch {
    return [];
  }
};

// ─── Verify payment signature (called after checkout modal closes) ─
const verifyPaymentSignature = ({ paymentId, subscriptionId, signature }) => {
  const body     = `${paymentId}|${subscriptionId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

// ─── Verify webhook signature ─────────────────────────────────────
const verifyWebhookSignature = (rawBody, signature) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = {
  isConfigured,
  createSubscription,
  getSubscription,
  cancelSubscription,
  listSubscriptionPayments,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
