/**
 * Map provider definitions and URL builders for the "View on Map" feature.
 *
 * Acceptable-use summary (recorded per issue requirement):
 *
 * | Provider      | Link policy                                                                      |
 * | ------------- | -------------------------------------------------------------------------------- |
 * | OpenStreetMap | Freely linkable; data is ODbL. No API key needed for plain search links.         |
 * | Google Maps   | Plain https://maps.google.com/?q= links are permitted for user-initiated         |
 * |               | navigation. No API key or attribution required for simple search deep-links.     |
 * |               | Ref: https://developers.google.com/maps/documentation/urls/get-started           |
 * | Bing Maps     | Plain https://www.bing.com/maps?q= links are permitted; no API key or            |
 * |               | attribution required for simple search deep-links.                               |
 * |               | Ref: https://docs.microsoft.com/en-us/bingmaps/articles/                         |
 * |               |       create-a-custom-map-url                                                    |
 * | Apple Maps    | https://maps.apple.com/?q= deep-links are permitted for user-initiated           |
 * |               | navigation. No API key needed; Apple redirects to the native app on Apple        |
 * |               | devices and falls back to a web view on others.                                  |
 * |               | Ref: https://developer.apple.com/library/archive/featuredarticles/               |
 * |               |       iPhoneURLScheme_Reference/MapLinks/MapLinks.html                           |
 *
 * All four providers accept simple query-string search links that open in the
 * user's browser or native app. No SDK, embed code, or API key is required.
 * These links are "user-navigated" (the user actively clicks to open a third-party
 * site), which is universally allowed under all four providers' terms of service.
 */

export type MapProviderId = 'openstreetmap' | 'google' | 'bing' | 'apple'

export interface MapProvider {
  id: MapProviderId
  /** Human-readable label shown in dropdowns and preferences. */
  label: string
  /** Short emoji used alongside the label. */
  emoji: string
}

export const MAP_PROVIDERS: MapProvider[] = [
  { id: 'openstreetmap', label: 'OpenStreetMap', emoji: '🗺️' },
  { id: 'google',        label: 'Google Maps',   emoji: '🌍' },
  { id: 'bing',          label: 'Bing Maps',     emoji: '🔵' },
  { id: 'apple',         label: 'Apple Maps',    emoji: '🍎' },
]

export const DEFAULT_MAP_PROVIDER: MapProviderId = 'openstreetmap'

export interface AddressComponents {
  line1?: string
  line2?: string
  line3?: string
  line4?: string
  city?: string
  region?: string
  country?: string
  postalCode?: string
}

/** Build a search query string from address components. */
export function buildAddressQuery(address: AddressComponents): string {
  const parts = [
    address.line1,
    address.line2,
    address.line3,
    address.line4,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ].filter(Boolean)
  return parts.join(', ')
}

/** Build the full map URL for the given provider and address. */
export function buildMapUrl(
  address: AddressComponents,
  providerId: MapProviderId = DEFAULT_MAP_PROVIDER,
): string {
  const query = buildAddressQuery(address)
  const encoded = encodeURIComponent(query)

  switch (providerId) {
    case 'google':
      return `https://www.google.com/maps/search/?api=1&query=${encoded}`
    case 'bing':
      return `https://www.bing.com/maps?q=${encoded}`
    case 'apple':
      return `https://maps.apple.com/?q=${encoded}`
    case 'openstreetmap':
    default:
      return `https://www.openstreetmap.org/search?query=${encoded}`
  }
}

/** Return the MapProvider descriptor for a given id, defaulting to OSM. */
export function getMapProvider(id: MapProviderId | string): MapProvider {
  return MAP_PROVIDERS.find((p) => p.id === id) ?? MAP_PROVIDERS[0]
}
