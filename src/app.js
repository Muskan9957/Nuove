const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const passport  = require('./config/passport');

const authRoutes        = require('./routes/auth');
const oauthRoutes       = require('./routes/oauth');
const scriptRoutes      = require('./routes/scripts');
const hookRoutes        = require('./routes/hooks');
const paymentRoutes     = require('./routes/payments');
const performanceRoutes = require('./routes/performance');
const calendarRoutes    = require('./routes/calendar');
const templateRoutes    = require('./routes/templates');
const trendingRoutes    = require('./routes/trending');
const reportRoutes      = require('./routes/reports');
const userRoutes        = require('./routes/user');
const captionRoutes     = require('./routes/captions');
const remixRoutes       = require('./routes/remix');
const creatorScoreRoutes = require('./routes/creatorScore');
const coachRoutes       = require('./routes/coach');
const hookLibraryRoutes = require('./routes/hookLibrary');
const ttsRoutes         = require('./routes/tts');
const reelReadyRoutes   = require('./routes/reelReady');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

// ─── Trust proxy (needed for ngrok / reverse proxies) ─────────────
app.set('trust proxy', 1);

// ─── Security & Logging ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://nuove.in',
  'https://www.nuove.in',
  'https://nuove.vercel.app',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile, curl) or matching origins
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true)
    // Allow all vercel.app preview deployments
    if (origin && origin.endsWith('.vercel.app')) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(passport.initialize());

// ─── Body Parsing ─────────────────────────────────────────────────
// Raw body needed for Stripe webhook signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
// Increased limit for Reel Ready base64 image/video frame payloads
app.use(express.json({ limit: '20mb' }));

// ─── Health Check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status : 'ok',
    service: 'AI Reel Coach API',
    version: '1.1.0',
    time   : new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/auth',        oauthRoutes);
app.use('/api/scripts',     scriptRoutes);
app.use('/api/hooks',       hookRoutes);
app.use('/api/payments',    paymentRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/calendar',    calendarRoutes);
app.use('/api/templates',   templateRoutes);
app.use('/api/trending',    trendingRoutes);
app.use('/api/reports',     reportRoutes);
app.use('/api/user',        userRoutes);
app.use('/api/captions',    captionRoutes);
app.use('/api/remix',       remixRoutes);
app.use('/api/score',       creatorScoreRoutes);
app.use('/api/coach',       coachRoutes);
app.use('/api/hooks',       hookLibraryRoutes);
app.use('/api/tts',         ttsRoutes);
app.use('/api/reel-ready', reelReadyRoutes);

// ─── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
