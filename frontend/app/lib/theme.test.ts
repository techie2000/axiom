import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyDarkMode, applyTheme, DEFAULT_THEME, resolveTheme } from './theme'

describe('theme helpers', () => {
  beforeEach(() => {
    let themeAttr: string | null = null
    const classes = new Set<string>()
    const store = new Map<string, string>()

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        documentElement: {
          setAttribute: (name: string, value: string) => {
            if (name === 'data-theme') themeAttr = value
          },
          getAttribute: (name: string) => (name === 'data-theme' ? themeAttr : null),
          removeAttribute: (name: string) => {
            if (name === 'data-theme') themeAttr = null
          },
          classList: {
            toggle: (name: string, enabled: boolean) => {
              if (enabled) classes.add(name)
              else classes.delete(name)
            },
            remove: (name: string) => {
              classes.delete(name)
            },
            contains: (name: string) => classes.has(name),
          },
        },
      },
    })

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        getItem: (key: string) => store.get(key) ?? null,
        clear: () => {
          store.clear()
        },
      },
    })
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('resolveTheme returns default when id is unknown', () => {
    const resolved = resolveTheme('does-not-exist')
    expect(resolved.id).toBe(DEFAULT_THEME)
  })

  it('applyTheme sets html data-theme and local storage', () => {
    applyTheme('supabase')

    expect(document.documentElement.getAttribute('data-theme')).toBe('supabase')
    expect(localStorage.getItem('theme')).toBe('supabase')
  })

  it('applyTheme falls back to default when id is invalid', () => {
    applyTheme('invalid-theme')

    expect(document.documentElement.getAttribute('data-theme')).toBe(DEFAULT_THEME)
    expect(localStorage.getItem('theme')).toBe(DEFAULT_THEME)
  })

  it('applyDarkMode toggles dark class and local storage values', () => {
    applyDarkMode(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('darkMode')).toBe('dark')

    applyDarkMode(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('darkMode')).toBe('light')
  })

  it('helpers do not throw when localStorage is unavailable', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => applyTheme('default')).not.toThrow()
    expect(() => applyDarkMode(true)).not.toThrow()
    expect(setItemSpy).toHaveBeenCalled()
  })
})
