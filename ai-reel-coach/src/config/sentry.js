const Sentry = require('@sentry/node');

// Activates only when SENTRY_DSN is set (so it's a no-op until you add the DSN).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn            : process.env.SENTRY_DSN,
    environment    : process.env.NODE_ENV || 'production',
    tracesSampleRate: 0,   // errors only — no performance overhead
  });
  console.log('[Sentry] error monitoring enabled');
}

module.exports = Sentry;
