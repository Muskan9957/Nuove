const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const cookieParser = require('cookie-parser');
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
const trendsV2DebugRoutes = require('./routes/trendsV2Debug');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

// ─── Trust proxy (needed for ngrok / reverse proxies) ─────────────
app.set('trust proxy', 1);

// ─── Security & Logging ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'https://nuove.in',
  'https://www.nuove.in',
  'https://nuove.vercel.app',
  // localhost dev origins only outside production
  ...(IS_PROD ? [] : ['http://localhost:3000', 'http://localhost:5173']),
].filter(Boolean)

const isDevOrigin = (origin) => {
  if (!origin) return false;
  // Allow localhost/127.0.0.1, local IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x), or ngrok tunnels
  const regex = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|.*\.ngrok-free\.app|.*\.ngrok\.io|.*\.ngrok-free\.dev)(:\d+)?$/;
  return regex.test(origin);
};

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl) or an exact allowlist match
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    // Allow Vercel preview deployments only outside production
    if (!IS_PROD && origin.endsWith('.vercel.app')) return cb(null, true)
    // Allow local development IPs & ngrok tunnels outside production
    if (!IS_PROD && isDevOrigin(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(passport.initialize());

// ─── Body Parsing ─────────────────────────────────────────────────
// Raw body needed for Razorpay webhook signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
// 10mb to accommodate base64 image uploads (Reel Ready)
app.use(express.json({ limit: '10mb' }));

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
const { protect } = require('./middleware/auth');
const scriptController = require('./controllers/scriptController');
app.get('/api/music/search', protect, scriptController.searchMusic);
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
app.use('/api/trends-v2-debug', trendsV2DebugRoutes);

// ─── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
