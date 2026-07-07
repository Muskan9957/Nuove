const express  = require('express');
const passport = require('../config/passport');
const jwt      = require('jsonwebtoken');
const router   = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper to parse cookies manually (since cookie-parser is not active)
const getCookie = (req, name) => {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const pair = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return pair ? pair.split('=')[1] : null;
};

// Middleware: save the incoming origin from Referer header
const saveOAuthOrigin = (req, res, next) => {
  const referer = req.headers.referer;
  if (referer) {
    try {
      const url = new URL(referer);
      res.cookie('oauth_origin', url.origin, { maxAge: 10 * 60 * 1000, httpOnly: true });
    } catch (e) {}
  }
  next();
};

// Middleware: the native app opens OAuth in the system browser with
// ?platform=android|ios. Overriding the origin cookie makes finishOAuth
// redirect to the app's deep link (in.nuove.app://auth) instead of a website,
// which reopens the app with the token. Runs AFTER saveOAuthOrigin so it wins.
const saveMobileOrigin = (req, res, next) => {
  if (req.query.platform === 'android' || req.query.platform === 'ios') {
    res.cookie('oauth_origin', encodeURIComponent('in.nuove.app://auth'), { maxAge: 10 * 60 * 1000, httpOnly: true });
  }
  next();
};

// ─── Helper: make JWT and redirect to frontend ────────────────────
const finishOAuth = (req, res) => {
  const user = req.user;
  const cookieOrigin = getCookie(req, 'oauth_origin');
  const targetOrigin = cookieOrigin ? decodeURIComponent(cookieOrigin) : FRONTEND_URL;
  res.clearCookie('oauth_origin');

  if (!user) {
    return res.redirect(`${targetOrigin}/?error=oauth_failed`);
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  // Redirect to frontend with token in query param — frontend stores it
  res.redirect(`${targetOrigin}/?token=${token}&name=${encodeURIComponent(user.name || '')}&plan=${user.plan}`);
};

// ─── Google ───────────────────────────────────────────────────────
router.get('/google',
  saveOAuthOrigin,
  saveMobileOrigin,
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get('/google/callback',
  (req, res, next) => {
    const cookieOrigin = getCookie(req, 'oauth_origin');
    const targetOrigin = cookieOrigin ? decodeURIComponent(cookieOrigin) : FRONTEND_URL;
    passport.authenticate('google', { session: false, failureRedirect: `${targetOrigin}/?error=google_failed` })(req, res, next);
  },
  finishOAuth
);

// ─── X / Twitter ──────────────────────────────────────────────────
router.get('/twitter',
  saveOAuthOrigin,
  passport.authenticate('twitter', { session: false })
);
router.get('/twitter/callback',
  (req, res, next) => {
    const cookieOrigin = getCookie(req, 'oauth_origin');
    const targetOrigin = cookieOrigin ? decodeURIComponent(cookieOrigin) : FRONTEND_URL;
    passport.authenticate('twitter', { session: false, failureRedirect: `${targetOrigin}/?error=twitter_failed` })(req, res, next);
  },
  finishOAuth
);

// ─── YouTube (same as Google, different scope) ────────────────────
router.get('/youtube',
  saveOAuthOrigin,
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly'],
    session: false,
  })
);
// YouTube shares Google's callback URL

// ─── Instagram ────────────────────────────────────────────────────
router.get('/instagram',
  saveOAuthOrigin,
  passport.authenticate('instagram', { session: false })
);
router.get('/instagram/callback',
  (req, res, next) => {
    const cookieOrigin = getCookie(req, 'oauth_origin');
    const targetOrigin = cookieOrigin ? decodeURIComponent(cookieOrigin) : FRONTEND_URL;
    passport.authenticate('instagram', { session: false, failureRedirect: `${targetOrigin}/?error=instagram_failed` })(req, res, next);
  },
  finishOAuth
);

module.exports = router;
