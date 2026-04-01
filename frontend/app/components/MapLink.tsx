'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PreferenceSavePrompt from './PreferenceSavePrompt'
import MapProviderIcon from './MapProviderIcon'
import {
  AddressComponents,
  MAP_PROVIDERS,
  MapProviderId,
  buildMapUrl,
  getMapProvider,
} from '../lib/map-providers'
import { useUserPreference } from '../lib/useUserPreference'

/**
 * How many times the user must choose an alternative provider before we
 * suggest they update their default preference.
 */
const REPEATED_USE_THRESHOLD = 3

/**
 * Session-storage key prefix for tracking alternative-provider click counts.
 * Reset on every new browser session so the prompt does not nag indefinitely.
 */
const SESSION_KEY_PREFIX = 'axiom_map_alt_clicks::'

function getAltClickCount(providerId: MapProviderId): number {
  if (typeof sessionStorage === 'undefined') return 0
  return parseInt(sessionStorage.getItem(`${SESSION_KEY_PREFIX}${providerId}`) ?? '0', 10)
}

function incrementAltClickCount(providerId: MapProviderId): number {
  if (typeof sessionStorage === 'undefined') return 0
  const next = getAltClickCount(providerId) + 1
  sessionStorage.setItem(`${SESSION_KEY_PREFIX}${providerId}`, String(next))
  return next
}

interface MapLinkProps {
  /** Address to resolve into a map search URL. */
  address: AddressComponents
  /** Optional className override for the main trigger button. */
  className?: string
}

/**
 * MapLink renders a "View on Map" button that opens the user's preferred map
 * provider. A small chevron next to the label reveals a dropdown of alternative
 * providers. When the user repeatedly picks the same alternative provider, a
 * PreferenceSavePrompt asks whether to update their default.
 */
export default function MapLink({ address, className }: MapLinkProps) {
  const { t } = useTranslation('common')

  // Stored preference – page key 'global', preference key 'map_provider'.
  const [storedProvider, setStoredProvider] = useUserPreference(
    'global',
    'map_provider',
    'openstreetmap',
  )

  const preferredProvider = getMapProvider(storedProvider)
  const preferredId = preferredProvider.id

  // Local state for the dropdown and the "save as default" prompt.
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [promptProviderId, setPromptProviderId] = useState<MapProviderId | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!dropdownOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [dropdownOpen])

  /** Open the preferred provider directly. */
  const handleMainClick = useCallback(() => {
    window.open(buildMapUrl(address, preferredId), '_blank', 'noopener,noreferrer')
  }, [address, preferredId])

  /** Open an alternative provider and track usage. */
  const handleAlternativeClick = useCallback(
    (providerId: MapProviderId) => {
      setDropdownOpen(false)
      window.open(buildMapUrl(address, providerId), '_blank', 'noopener,noreferrer')

      if (providerId === preferredId) return

      const count = incrementAltClickCount(providerId)
      if (count >= REPEATED_USE_THRESHOLD) {
        setPromptProviderId(providerId)
        setShowSavePrompt(true)
      }
    },
    [address, preferredId],
  )

  const handleSaveNewDefault = useCallback(() => {
    if (promptProviderId) {
      setStoredProvider(promptProviderId)
      // Reset the click counter so the prompt won't fire again straight away.
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${promptProviderId}`)
      }
    }
    setShowSavePrompt(false)
    setPromptProviderId(null)
  }, [promptProviderId, setStoredProvider])

  const handleDismissSavePrompt = useCallback(() => {
    setShowSavePrompt(false)
    setPromptProviderId(null)
  }, [])

  const newDefaultProvider = promptProviderId ? getMapProvider(promptProviderId) : null
  const savePromptLabel = newDefaultProvider
    ? t('mapProvider.setDefaultPrompt', {
        provider: t(newDefaultProvider.labelKey, { defaultValue: newDefaultProvider.label }),
      })
    : undefined

  const mainBtnClass =
    className ??
    'text-[rgb(var(--primary-rgb))] hover:text-[rgb(var(--primary-rgb))] text-xs font-medium flex items-center gap-1 transition-colors'

  const viewOnMapLabel = t('mapProvider.viewOnMapTitle', {
    provider: t(preferredProvider.labelKey, { defaultValue: preferredProvider.label }),
  })
  const chooseProviderLabel = t('mapProvider.chooseProvider')

  return (
    <>
      <div className="relative inline-flex items-center gap-0.5" ref={dropdownRef}>
        {/* Primary "View on Map" button */}
        <button
          type="button"
          onClick={handleMainClick}
          className={mainBtnClass}
          title={viewOnMapLabel}
          aria-label={viewOnMapLabel}
        >
          <MapProviderIcon providerId={preferredId} className="w-3.5 h-3.5 shrink-0" />
          {t('leiRecords.modal.viewOnMap')}
        </button>

        {/* Dropdown chevron */}
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="text-[rgb(var(--primary-rgb))] hover:text-[rgb(var(--primary-rgb))] text-xs px-0.5 py-0.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))]"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label={chooseProviderLabel}
          title={chooseProviderLabel}
        >
          ▾
        </button>

        {/* Provider dropdown */}
        {dropdownOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] rounded-lg border theme-dropdown shadow-xl py-1"
            role="listbox"
            aria-label={t('mapProvider.chooseProvider', { defaultValue: 'Choose map provider' })}
          >
            <p
              role="presentation"
              className="px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide theme-text-muted border-b border-[rgb(var(--border-rgb))] mb-1"
            >
              {t('mapProvider.openWith')}
            </p>
            {MAP_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                role="option"
                aria-selected={provider.id === preferredId}
                onClick={() => handleAlternativeClick(provider.id)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-[rgb(var(--accent-rgb))/10] focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--ring-rgb))] ${
                  provider.id === preferredId
                    ? 'font-semibold text-[rgb(var(--primary-rgb))]'
                    : 'theme-text-muted'
                }`}
              >
                <MapProviderIcon providerId={provider.id} className="w-3.5 h-3.5 shrink-0" />
                {t(provider.labelKey, { defaultValue: provider.label })}
                {provider.id === preferredId && (
                  <span className="ml-auto text-[0.6rem] theme-text-muted">
                    {t('mapProvider.default')}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prompt to save new default after repeated use of an alternative */}
      <PreferenceSavePrompt
        visible={showSavePrompt}
        onSave={handleSaveNewDefault}
        onDismiss={handleDismissSavePrompt}
        label={savePromptLabel}
      />
    </>
  )
}
