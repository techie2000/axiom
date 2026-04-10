'use client'

import { useCallback } from 'react'
import { useUserPreference } from './useUserPreference'

export type EmojiMode = 'both' | 'text' | 'emoji'

function isEmojiMode(value: string): value is EmojiMode {
  return value === 'both' || value === 'text' || value === 'emoji'
}

/**
 * Matches one or more leading Extended_Pictographic codepoints, each optionally
 * followed by a variation-selector (U+FE0F) or combining-enclosing-keycap (U+20E3),
 * and any trailing whitespace.
 */
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}\uFE0F?\u20E3?\s*)+/u

/**
 * Transforms a button/action label according to the user's emoji display preference.
 *
 * - `'both'`  – return the label unchanged (default, text + emoji)
 * - `'text'`  – strip leading emoji characters and return the remaining text
 * - `'emoji'` – return only the leading emoji; fall back to the full label when
 *               no leading emoji is found (so the control is never empty)
 */
export function applyEmojiMode(label: string, mode: EmojiMode): string {
  if (mode === 'both') return label

  const match = label.match(LEADING_EMOJI_RE)
  const emojiPart = match ? match[0].trimEnd() : ''
  const textPart = label.replace(LEADING_EMOJI_RE, '').trimStart()

  if (mode === 'text') return textPart || label
  // emoji-only: show just the leading emoji, fall back to full label when absent
  return emojiPart || label
}

/**
 * Hook that reads the user's preferred emoji display mode for page header action
 * buttons and returns a `formatLabel` transformer to apply it.
 *
 * Preference is stored globally under key `global/button_emoji_mode` with the
 * default value `'both'` (text + emoji).
 */
export function useButtonEmojiMode() {
  const [storedMode, setStoredMode] = useUserPreference('global', 'button_emoji_mode', 'both')
  const mode: EmojiMode = isEmojiMode(storedMode) ? storedMode : 'both'

  const formatLabel = useCallback(
    (label: string): string => applyEmojiMode(label, mode),
    [mode],
  )

  return {
    emojiMode: mode,
    setEmojiMode: setStoredMode,
    formatLabel,
  }
}
