const path = require('path')
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },
}

// Wrap with Sentry only when a DSN is provided; otherwise return the base config
// unchanged so that local dev and CI builds work without a Sentry account.
const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN

module.exports = sentryDSN
  ? withSentryConfig(nextConfig, {
      // Sentry webpack plugin options (build-time)
      org: process.env.SENTRY_ORG || '',
      project: process.env.SENTRY_PROJECT || 'axiom-frontend',

      // Suppress the Sentry CLI progress output in CI logs.
      silent: Boolean(process.env.CI),

      // Upload source maps to Sentry for readable stack traces.
      // Requires SENTRY_AUTH_TOKEN to be set.
      widenClientFileUpload: true,

      // Automatically tree-shake Sentry logger statements for smaller bundles.
      disableLogger: true,

      // Hide the Sentry SDK from bundle analysis to reduce noise.
      hideSourceMaps: true,

      // Disable automatic instrumentation of Vercel Cron Monitors.
      automaticVercelMonitors: false,
    })
  : nextConfig

