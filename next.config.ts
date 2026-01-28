import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

const nextConfig: NextConfig = {
  /* config options here */
}

export default withSentryConfig(withNextIntl(nextConfig), {
  // Suppress source map upload logs in CI
  silent: true,

  // Upload source maps only when SENTRY_AUTH_TOKEN is available
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
})
