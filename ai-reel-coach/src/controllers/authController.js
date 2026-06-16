const bcrypt           = require('bcryptjs');
const jwt              = require('jsonwebtoken');
const crypto           = require('crypto');
const dns              = require('dns').promises;
const { validationResult } = require('express-validator');
const prisma           = require('../config/prisma');
const { sendPasswordReset, sendWelcome, sendVerificationEmail } = require('../services/emailService');

// ─── Validate email domain has MX records ────────────────────────
const isValidEmailDomain = async (email) => {
  try {
    const domain  = email.split('@')[1];
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
};

// ─── Helpers ─────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const getCurrentStreak = (user) => {
  if (!user || !user.lastActiveDate || !user.streak) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (user.lastActiveDate === today || user.lastActiveDate === yesterday) {
    return user.streak;
  }
  return 0;
};

// ─── REGISTER ────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Reject fake/non-existent email domains
    const domainValid = await isValidEmailDomain(email);
    if (!domainValid) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        emailVerified          : false,
        emailVerificationToken : verificationToken,
      },
    });

    // Send verification email (non-blocking)
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    sendVerificationEmail({ to: user.email, name: user.name, verifyUrl })
      .then(() => console.log(`[REGISTER] Verification email sent to ${user.email}`))
      .catch(err => console.error('[REGISTER] Failed to send verification email:', err.message));

    return res.status(201).json({
      message: 'Account created! Please check your email to verify your account.',
      needsVerification: true,
    });
  } catch (err) {
    next(err);
  }
};

// ─── LOGIN ───────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // OAuth-only account — no password set
    if (!user.passwordHash) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please use the Google button to log in.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Email not verified yet — generate a fresh token and resend email
    if (!user.emailVerified) {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: verificationToken }
      });
      
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      sendVerificationEmail({ to: user.email, name: user.name, verifyUrl })
        .then(() => console.log(`[LOGIN] Verification email re-sent to ${user.email}`))
        .catch(err => console.error('[LOGIN] Failed to send verification email:', err.message));

      return res.status(403).json({ error: 'Please verify your email before logging in. We have sent a new link to your inbox.', needsVerification: true });
    }

    const token = signToken(user);
    return res.json({
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan, avatar: user.avatar, streak: getCurrentStreak(user) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET ME ──────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: {
        id              : true,
        email           : true,
        name            : true,
        avatar          : true,
        plan            : true,
        streak          : true,
        lastActiveDate  : true,
        generationsUsed : true,
        generationsReset: true,
        createdAt       : true,
        onboarded       : true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.streak = getCurrentStreak(user);
    return res.json({ user });
  } catch (err) {
    next(err);
  }
};

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success — don't reveal whether email exists
    if (!user || !user.passwordHash) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate a secure random token
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data : { passwordResetToken: token, passwordResetExpires: expires },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await sendPasswordReset({ to: user.email, name: user.name, resetUrl });

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ─── RESET PASSWORD ──────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strong.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken  : token,
        passwordResetExpires: { gt: new Date() }, // not expired
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data : {
        passwordHash,
        passwordResetToken  : null,
        passwordResetExpires: null,
      },
    });

    const authToken = signToken(user);
    return res.json({
      message: 'Password reset successfully!',
      token  : authToken,
      user   : { id: user.id, email: user.email, name: user.name, plan: user.plan, avatar: user.avatar, streak: getCurrentStreak(user) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── VERIFY EMAIL ────────────────────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data : { emailVerified: true, emailVerificationToken: null },
    });

    // Send welcome email now that they're verified
    sendWelcome({ to: user.email, name: user.name })
      .catch(err => console.error('[VERIFY] Failed to send welcome email:', err.message));

    const authToken = signToken(user);
    return res.json({
      message: 'Email verified successfully! Welcome to Nuove.',
      token  : authToken,
      user   : { id: user.id, email: user.email, name: user.name, plan: user.plan, avatar: user.avatar, streak: 0 },
    });
  } catch (err) {
    next(err);
  }
};

// ─── VERIFICATION STATUS (polled by frontend "check inbox" screen) ───
const verificationStatus = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email is required.' });

    const user = await prisma.user.findUnique({
      where : { email },
      select: { emailVerified: true },
    });

    return res.json({ verified: !!(user && user.emailVerified) });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword, verifyEmail, verificationStatus };
