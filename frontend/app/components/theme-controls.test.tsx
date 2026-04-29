import { afterEach, describe, expect, it, vi } from 'vitest'

type MockPreference = {
  value: string
  setValue: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  dismiss: ReturnType<typeof vi.fn>
  showPrompt: boolean
  promptResetKey: number
  showUndo: boolean
  undoResetKey: number
  undo: ReturnType<typeof vi.fn>
  undoDismiss: ReturnType<typeof vi.fn>
}

function createPreference(value: string): MockPreference {
  return {
    value,
    setValue: vi.fn(),
    save: vi.fn(),
    dismiss: vi.fn(),
    showPrompt: false,
    promptResetKey: 0,
    showUndo: false,
    undoResetKey: 0,
    undo: vi.fn(),
    undoDismiss: vi.fn(),
  }
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value.filter(Boolean) as T[]
  return value == null ? [] : [value]
}

async function loadThemeSelector(options?: {
  mounted?: boolean
  open?: boolean
  value?: string
  runEffects?: boolean
  containsTarget?: boolean
}) {
  vi.resetModules()

  const mounted = options?.mounted ?? true
  const open = options?.open ?? false
  const value = options?.value ?? 'default'
  const runEffects = options?.runEffects ?? false
  const containsTarget = options?.containsTarget ?? false

  const setMounted = vi.fn()
  const setOpen = vi.fn()
  const applyTheme = vi.fn()
  const themePreference = createPreference(value)
  const listeners = new Map<string, (event: unknown) => void>()
  const NodeCtor = class {}

  Object.defineProperty(globalThis, 'Node', {
    configurable: true,
    value: NodeCtor,
  })

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
        listeners.set(type, handler)
      }),
      removeEventListener: vi.fn(),
    },
  })

  vi.doMock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react')
    return {
      ...actual,
      useState: vi.fn()
        .mockImplementationOnce(() => [mounted, setMounted])
        .mockImplementationOnce(() => [open, setOpen]),
      useEffect: vi.fn((callback: () => void | (() => void)) => {
        if (runEffects) callback()
      }),
      useRef: vi.fn()
        .mockImplementationOnce(() => ({
          current: {
            contains: vi.fn(() => containsTarget),
          },
        }))
        .mockImplementationOnce(() => ({ current: null })),
    }
  })

  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }))

  vi.doMock('../lib/useDeferredStringPreference', () => ({
    useDeferredStringPreference: () => themePreference,
  }))

  vi.doMock('../lib/theme', () => {
    const themes = [
      {
        id: 'default',
        label: 'preferences.themes.default',
        description: 'preferences.themes.defaultDescription',
        emoji: '🎨',
      },
      {
        id: 'supabase',
        label: 'preferences.themes.supabase',
        description: 'preferences.themes.supabaseDescription',
        emoji: '🌿',
      },
    ]
    return {
      THEMES: themes,
      applyTheme,
      resolveTheme: (themeId: string) => themes.find((theme) => theme.id === themeId) ?? themes[0],
    }
  })

  vi.doMock('./PreferenceSavePrompt', () => ({
    default: () => null,
  }))

  const { default: ThemeSelector } = await import('./ThemeSelector')

  return {
    element: ThemeSelector(),
    applyTheme,
    listeners,
    NodeCtor,
    setMounted,
    setOpen,
    themePreference,
  }
}

async function loadThemeToggle(options?: {
  mounted?: boolean
  value?: string
  runEffects?: boolean
}) {
  vi.resetModules()

  const mounted = options?.mounted ?? true
  const value = options?.value ?? 'dark'
  const runEffects = options?.runEffects ?? false

  const setMounted = vi.fn()
  const applyDarkMode = vi.fn()
  const preference = createPreference(value)

  vi.doMock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react')
    return {
      ...actual,
      useState: vi.fn().mockImplementationOnce(() => [mounted, setMounted]),
      useEffect: vi.fn((callback: () => void | (() => void)) => {
        if (runEffects) callback()
      }),
    }
  })

  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }))

  vi.doMock('../lib/useDeferredStringPreference', () => ({
    useDeferredStringPreference: () => preference,
  }))

  vi.doMock('../lib/theme', () => ({
    applyDarkMode,
  }))

  vi.doMock('./PreferenceSavePrompt', () => ({
    default: () => null,
  }))

  const { default: ThemeToggle } = await import('./ThemeToggle')

  return {
    element: ThemeToggle(),
    applyDarkMode,
    preference,
    setMounted,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('react')
  vi.doUnmock('react-i18next')
  vi.doUnmock('../lib/useDeferredStringPreference')
  vi.doUnmock('../lib/theme')
  vi.doUnmock('./PreferenceSavePrompt')
  delete (globalThis as { document?: unknown }).document
  delete (globalThis as { Node?: unknown }).Node
})

describe('theme controls', () => {
  it('renders a disabled pre-hydration ThemeSelector placeholder', async () => {
    const { element } = await loadThemeSelector({ mounted: false })

    expect(element.type).toBe('button')
    expect(element.props.type).toBe('button')
    expect(element.props.disabled).toBe(true)
    expect(element.props['aria-disabled']).toBe('true')

    const children = asArray(element.props.children)
    expect(children[1].props.children).toBe('preferences.theme')
  })

  it('selecting a theme updates the deferred preference and closes the menu', async () => {
    const { element, setOpen, themePreference } = await loadThemeSelector({
      mounted: true,
      open: true,
      value: 'default',
    })

    const fragmentChildren = asArray(element.props.children)
    const container = fragmentChildren[0]
    const containerChildren = asArray(container.props.children)
    const listbox = containerChildren[1]
    const optionButtons = asArray(listbox.props.children)
    const supabaseOption = optionButtons.find((option) => option.key === 'supabase')

    expect(supabaseOption).toBeDefined()
    supabaseOption!.props.onClick()

    expect(themePreference.setValue).toHaveBeenCalledWith('supabase')
    expect(setOpen).toHaveBeenCalledWith(false)
  })

  it('closes the ThemeSelector on outside click and Escape', async () => {
    const { listeners, NodeCtor, setOpen } = await loadThemeSelector({
      mounted: true,
      open: true,
      runEffects: true,
      containsTarget: false,
    })

    expect(listeners.has('mousedown')).toBe(true)
    expect(listeners.has('keydown')).toBe(true)

    listeners.get('mousedown')?.({ target: new NodeCtor() })
    listeners.get('keydown')?.({ key: 'Escape' })

    expect(setOpen).toHaveBeenCalledWith(false)
  })

  it('applies the active palette on mount and toggles dark mode preference', async () => {
    const selector = await loadThemeSelector({
      mounted: true,
      open: false,
      value: 'supabase',
      runEffects: true,
    })
    expect(selector.applyTheme).toHaveBeenCalledWith('supabase')
    expect(selector.setMounted).toHaveBeenCalledWith(true)

    const toggle = await loadThemeToggle({
      mounted: true,
      value: 'dark',
      runEffects: true,
    })

    expect(toggle.applyDarkMode).toHaveBeenCalledWith(true)

    const toggleChildren = asArray(toggle.element.props.children)
    const button = toggleChildren[0]
    button.props.onClick()

    expect(toggle.preference.setValue).toHaveBeenCalledWith('light')
  })
})