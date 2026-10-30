import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: [
        'app/**/*.test.{ts,tsx}',
        'app/**/*.d.ts',
        // Next.js page/layout entry points — mostly wiring, not logic
        'app/**/page.tsx',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
        // Styles and config
        'app/globals.css',
        // Large React UI components that require browser-level rendering;
        // these are better validated through E2E tests.
        'app/components/**/*.tsx',
      ],
      thresholds: {
        lines: 50,
        statements: 50,
        branches: 70,
        functions: 60,
      },
    },
  },
})
