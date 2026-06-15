const bcrypt           = require('bcryptjs');
const jwt              = require('jsonwebtoken');
const crypto           = require('crypto');
const { validationResult } = require('express-validator');
const prisma           = require('../config/prisma');
const { sendPasswordReset, sendWelcome } = require('../services/emailService');

// ─── Helpers ─────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// ─── REGISTER ────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const token = signToken(user);

    // Send welcome email (non-blocking)
    sendWelcome({ to: user.email, name: user.name }).catch(() => {});

    const safeUser = { id: user.id, email: user.email, name: user.name, plan: user.plan, generationsUsed: user.generationsUsed, streak: user.streak, avatar: user.avatar, createdAt: user.createdAt };

    return res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: safeUser,
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

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = { id: user.id, email: user.email, name: user.name, plan: user.plan, generationsUsed: user.generationsUsed, streak: user.streak, avatar: user.avatar, createdAt: user.createdAt };

    const token = signToken(user);
    return res.json({
      message: 'Logged in successfully!',
      token,
      user: safeUser,
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
        plan            : true,
        generationsUsed : true,
        generationsReset: true,
        createdAt       : true,
        onboarded       : true,
        avatar          : true,
        streak          : true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
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
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
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

    const safeUser = { id: user.id, email: user.email, name: user.name, plan: user.plan, generationsUsed: user.generationsUsed, streak: user.streak, avatar: user.avatar, createdAt: user.createdAt };

    const authToken = signToken(user);
    return res.json({
      message: 'Password reset successfully!',
      token  : authToken,
      user   : safeUser,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword };
