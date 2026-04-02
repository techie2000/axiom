/**
 * Example authenticated Playwright test.
 *
 * This spec demonstrates how to write an end-to-end test that uses the
 * pre-authenticated session established by e2e/auth.setup.ts. The session is
 * injected automatically via `use.storageState` in playwright.config.ts, so no
 * manual login is required here.
 *
 * Run with:
 *   npm run test:e2e
 */
import { test, expect } from '@playwright/test'

test.describe('Authenticated navigation', () => {
  test('redirects from / to /dashboard when logged in', async ({ page }) => {
    // The root page should redirect authenticated users to the dashboard.
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('dashboard renders without login prompt', async ({ page }) => {
    await page.goto('/dashboard')

    // Should NOT be redirected back to login.
    await expect(page).not.toHaveURL(/\/login/)

    // The page must have a visible main content area.
    await expect(page.locator('main')).toBeVisible()
  })
})
