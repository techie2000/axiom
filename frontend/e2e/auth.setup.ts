/**
 * Auth setup for Playwright end-to-end tests.
 *
 * This file is matched by the "setup" project in playwright.config.ts and runs
 * before any test file. It logs in as the dedicated Playwright test user
 * (provisioned automatically on backend startup when PLAYWRIGHT_SEED_USER=true)
 * and saves the resulting browser storage state to e2e/.auth/user.json.
 *
 * Every subsequent test project in playwright.config.ts inherits this saved
 * session via `use.storageState`, so individual tests never need to repeat the
 * login flow.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { AUTH_STATE_PATH } from '../config'

const authFile = path.join(__dirname, '..', AUTH_STATE_PATH)

setup('authenticate as playwright test user', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_USER_EMAIL ?? 'playwright@axiom.local'
  const password = process.env.PLAYWRIGHT_USER_PASSWORD ?? 'Playwright1!'

  // Navigate to the login page.
  await page.goto('/login')

  // Wait for the form to be interactive.
  await page.waitForSelector('#email', { state: 'visible' })

  // Fill in credentials for the dedicated Playwright test user.
  await page.fill('#email', email)
  await page.fill('#password', password)

  // Submit the form.
  await page.click('button[type="submit"]')

  // After a successful login the app redirects to /dashboard.
  // Wait for navigation away from /login to confirm authentication succeeded.
  // Allow overriding the timeout via PLAYWRIGHT_AUTH_TIMEOUT (milliseconds).
  const authTimeoutMs = parseInt(process.env.PLAYWRIGHT_AUTH_TIMEOUT ?? '15000', 10)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: authTimeoutMs,
  })

  // Verify we landed on an authenticated page.
  await expect(page).not.toHaveURL(/\/login/)

  // Persist the authenticated session for all subsequent test projects.
  await page.context().storageState({ path: authFile })
})
