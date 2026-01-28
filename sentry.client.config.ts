import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring sample rate (adjust for production)
  tracesSampleRate: 0.1,

  // Replay configuration
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
})
