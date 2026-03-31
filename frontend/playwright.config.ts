import { defineConfig, devices } from '@playwright/test'
import { AUTH_STATE_PATH } from './e2e/config'

/**
 * Playwright end-to-end test configuration for Axiom.
 *
 * Prerequisites (dev/main environments):
 *   1. Ensure PLAYWRIGHT_SEED_USER=true is set in the backend .env file so the
 *      dedicated test user (playwright@axiom.local) is created on startup.
 *   2. Run `npm run playwright:install` once to download the required browsers.
 *   3. Start the full stack: `docker compose --env-file .env.dev -f docker-compose.dev.yml up`
 *
 * Running tests:
 *   npm run test:e2e          — headless, all browsers
 *   npm run test:e2e:ui       — interactive Playwright UI
 *   npm run test:e2e:report   — open the last HTML report
 *
 * The "setup" project runs auth.setup.ts first to acquire and cache a session
 * token in e2e/.auth/user.json. All other test projects depend on "setup" and
 * reuse the cached session so tests do not need to log in individually.
 *
 * Environment variables (all optional — sensible defaults are provided):
 *   PLAYWRIGHT_BASE_URL        Frontend origin.       Default: http://localhost:13000
 *   PLAYWRIGHT_API_URL         Backend API origin.    Default: http://localhost:18080
 *   PLAYWRIGHT_USER_EMAIL      Test user email.       Default: playwright@axiom.local
 *   PLAYWRIGHT_USER_PASSWORD   Test user password.    Default: Playwright1!
 */
export default defineConfig({
  testDir: './e2e/tests',

  // Fail the build on CI if any test file is left unfulfilled.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:13000',
    // Reuse the authenticated session acquired by the "setup" project.
    storageState: AUTH_STATE_PATH,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── Auth setup ────────────────────────────────────────────────────────────
    // This special project runs auth.setup.ts before any other project. It logs
    // in as the Playwright test user and saves the browser storage state so
    // subsequent test projects can skip the login flow entirely.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      // The setup project does NOT use the cached session — it creates it.
      use: { storageState: undefined },
    },

    // ── Browser projects ──────────────────────────────────────────────────────
    // Add more browsers here (e.g. 'firefox', 'webkit') as needed.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
})
