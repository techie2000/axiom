/**
 * Shared Playwright end-to-end test constants.
 *
 * Centralise values used across multiple e2e files (auth.setup.ts,
 * playwright.config.ts, test helpers) so a single change keeps everything
 * in sync.
 */

/** Path where auth.setup.ts saves the authenticated browser session. */
export const AUTH_STATE_PATH = 'e2e/.auth/user.json'
