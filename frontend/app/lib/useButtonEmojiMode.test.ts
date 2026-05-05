// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyEmojiMode, ensureLeadingEmoji, useButtonEmojiMode } from './useButtonEmojiMode'
import { useUserPreference } from './useUserPreference'

vi.mock('./useUserPreference', () => ({
  useUserPreference: vi.fn(() => ['both', vi.fn()]),
}))

describe('applyEmojiMode', () => {
  describe("mode 'both'", () => {
    it('returns the label unchanged', () => {
      expect(applyEmojiMode('⬅️ Normal', 'both')).toBe('⬅️ Normal')
      expect(applyEmojiMode('⚙️ Columns (9)', 'both')).toBe('⚙️ Columns (9)')
      expect(applyEmojiMode('Documentation', 'both')).toBe('Documentation')
    })
  })

  describe("mode 'text'", () => {
    it('strips a single leading emoji + space', () => {
      expect(applyEmojiMode('⬅️ Normal', 'text')).toBe('Normal')
      expect(applyEmojiMode('↔️ Expand', 'text')).toBe('Expand')
      expect(applyEmojiMode('⚙️ Columns (9)', 'text')).toBe('Columns (9)')
      expect(applyEmojiMode('🏷️ Display: Names', 'text')).toBe('Display: Names')
      expect(applyEmojiMode('📖 Documentation', 'text')).toBe('Documentation')
    })

    it('returns the label unchanged when no leading emoji is present', () => {
      expect(applyEmojiMode('Documentation', 'text')).toBe('Documentation')
      expect(applyEmojiMode('Normal', 'text')).toBe('Normal')
    })
  })

  describe("mode 'emoji'", () => {
    it('returns only the leading emoji', () => {
      expect(applyEmojiMode('⬅️ Normal', 'emoji')).toBe('⬅️')
      expect(applyEmojiMode('↔️ Expand', 'emoji')).toBe('↔️')
      expect(applyEmojiMode('⚙️ Columns (9)', 'emoji')).toBe('⚙️')
      expect(applyEmojiMode('🏷️ Display: Names', 'emoji')).toBe('🏷️')
      expect(applyEmojiMode('📖 Documentation', 'emoji')).toBe('📖')
    })

    it('falls back to the full label when no leading emoji is present', () => {
      expect(applyEmojiMode('Documentation', 'emoji')).toBe('Documentation')
      expect(applyEmojiMode('Normal', 'emoji')).toBe('Normal')
    })
  })
})

describe('ensureLeadingEmoji', () => {
  it('prepends emoji when none exists', () => {
    expect(ensureLeadingEmoji('Columns (9)', '⚙️')).toBe('⚙️ Columns (9)')
    expect(ensureLeadingEmoji('Display: Names', '🏷️')).toBe('🏷️ Display: Names')
  })

  it('keeps existing leading emoji unchanged', () => {
    expect(ensureLeadingEmoji('⚙️ Columns (9)', '⚙️')).toBe('⚙️ Columns (9)')
    expect(ensureLeadingEmoji('🏷️ Display: Names', '🏷️')).toBe('🏷️ Display: Names')
  })
})

describe('useButtonEmojiMode', () => {
  it('returns emojiMode, setEmojiMode, and formatLabel', () => {
    const { result } = renderHook(() => useButtonEmojiMode())

    expect(result.current.emojiMode).toBe('both')
    expect(typeof result.current.setEmojiMode).toBe('function')
    expect(typeof result.current.formatLabel).toBe('function')
  })

  it('formatLabel applies the current mode', () => {
    const { result } = renderHook(() => useButtonEmojiMode())

    // Default mocked mode is 'both' so label is returned as-is
    expect(result.current.formatLabel('⬅️ Normal')).toBe('⬅️ Normal')
  })

  it('formatLabel strips emoji when mode is text', () => {
    vi.mocked(useUserPreference).mockReturnValueOnce(['text', vi.fn()])

    const { result } = renderHook(() => useButtonEmojiMode())

    expect(result.current.formatLabel('⬅️ Normal')).toBe('Normal')
  })

  it('formatLabel returns only the emoji when mode is emoji', () => {
    vi.mocked(useUserPreference).mockReturnValueOnce(['emoji', vi.fn()])

    const { result } = renderHook(() => useButtonEmojiMode())

    expect(result.current.formatLabel('⬅️ Normal')).toBe('⬅️')
  })
})
