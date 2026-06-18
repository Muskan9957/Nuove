const Sentry = require('@sentry/node');

/**
 * Global error handler — catches anything that calls next(err).
 * Returns clean JSON errors instead of HTML stack traces.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Something went wrong on our end.';

  // Report server-side (5xx) errors to Sentry when configured (no-op otherwise)
  if (statusCode >= 500) Sentry.captureException(err);

  res.status(statusCode).json({
    error  : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
