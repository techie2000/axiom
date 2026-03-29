// This file configures the Sentry SDK initialization for the Edge Runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV,

    // Capture 10 % of transactions for performance monitoring.
    tracesSampleRate: 0.1,

    // Do not track user IP addresses (privacy / GDPR compliance).
    sendDefaultPii: false,
  })
}
