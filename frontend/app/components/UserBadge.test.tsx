// @vitest-environment jsdom
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserBadge from './UserBadge'

(globalThis as { React?: typeof React }).React = React

const mocks = vi.hoisted(() => ({
  applyTheme: vi.fn(),
  applyDarkMode: vi.fn(),
  replace: vi.fn(),
  setMapProvider: vi.fn(),
  setEnglishTooltipsPreferenceEnabled: vi.fn(),
  setEmojiMode: vi.fn(),
  mapProvider: 'openstreetmap',
  theme: 'default',
  darkMode: 'dark',
  user: {
    username: 'tester',
    full_name: 'Test User',
    email: 'tester@example.com',
    role: 'admin',
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../lib/stored-user', () => ({
  readStoredUser: () => mocks.user,
}))

vi.mock('../lib/useEnglishTooltips', () => ({
  useEnglishTooltips: () => ({
    englishTooltipsPreferenceEnabled: false,
    setEnglishTooltipsPreferenceEnabled: mocks.setEnglishTooltipsPreferenceEnabled,
  }),
}))

vi.mock('../lib/useButtonEmojiMode', () => ({
  useButtonEmojiMode: () => ({
    emojiMode: 'both',
    setEmojiMode: mocks.setEmojiMode,
  }),
}))

vi.mock('../lib/useUserPreference', () => ({
  resetPreferencesCache: vi.fn(),
  useUserPreference: (_pageKey: string, prefKey: string, defaultValue: string) => {
    if (prefKey === 'map_provider') {
      return [mocks.mapProvider, mocks.setMapProvider, false] as const
    }
    if (prefKey === 'theme') {
      return [mocks.theme, vi.fn(), false] as const
    }
    if (prefKey === 'dark_mode') {
      return [mocks.darkMode, vi.fn(), false] as const
    }
    return [defaultValue, vi.fn(), false] as const
  },
}))

vi.mock('../lib/theme', () => ({
  applyTheme: mocks.applyTheme,
  applyDarkMode: mocks.applyDarkMode,
}))

vi.mock('./MapProviderIcon', () => ({
  default: () => null,
}))

vi.mock('./ThemeSelector', () => ({
  default: () => null,
}))

vi.mock('./ThemeToggle', () => ({
  default: () => null,
}))

vi.mock('./LanguageSelector', () => ({
  default: () => null,
}))

describe('UserBadge theme bootstrapping', () => {
  beforeEach(() => {
    mocks.applyTheme.mockReset()
    mocks.applyDarkMode.mockReset()
    mocks.replace.mockReset()
    mocks.setMapProvider.mockReset()
    mocks.setEnglishTooltipsPreferenceEnabled.mockReset()
    mocks.setEmojiMode.mockReset()
    mocks.mapProvider = 'openstreetmap'
    mocks.theme = 'default'
    mocks.darkMode = 'dark'
  })

  it('applies theme and dark mode when preference values change', async () => {
    const { rerender } = render(<UserBadge />)

    await waitFor(() => {
      expect(mocks.applyTheme).toHaveBeenCalledWith('default')
      expect(mocks.applyDarkMode).toHaveBeenCalledWith(true)
    })

    mocks.theme = 'supabase'
    mocks.darkMode = 'light'

    rerender(<UserBadge />)

    await waitFor(() => {
      expect(mocks.applyTheme).toHaveBeenCalledWith('supabase')
      expect(mocks.applyDarkMode).toHaveBeenCalledWith(false)
    })
  })
})