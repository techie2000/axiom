import { describe, expect, it } from 'vitest'
import { applyEmojiMode } from './useButtonEmojiMode'

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
