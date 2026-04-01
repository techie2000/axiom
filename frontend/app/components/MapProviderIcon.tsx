/**
 * MapProviderIcon renders a small on-brand SVG icon for each supported map
 * provider.  Icons are original artwork styled in each provider's primary brand
 * colour.  They do NOT reproduce any trademarked logos.
 */

import { MapProviderId } from '../lib/map-providers'

interface MapProviderIconProps {
  providerId: MapProviderId
  /** Tailwind / inline size class – defaults to "w-4 h-4" */
  className?: string
  /** aria-label for the icon element (should be provided by the parent, so defaults to "" to hide from AT) */
  ariaLabel?: string
}

// ── Shared SVG pin shape ──────────────────────────────────────────────────────
// Classic teardrop map-pin with a centred circle cutout.  Rendered at 16×16.

function PinIcon({ fill, dot = '#ffffff', className = 'w-4 h-4', ariaLabel = '' }: {
  fill: string
  dot?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden={ariaLabel ? undefined : 'true'}
      aria-label={ariaLabel || undefined}
      role={ariaLabel ? 'img' : undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Pin body */}
      <path
        d="M8 1C5.24 1 3 3.24 3 6C3 9.87 8 15 8 15C8 15 13 9.87 13 6C13 3.24 10.76 1 8 1Z"
        fill={fill}
      />
      {/* Inner circle cutout */}
      <circle cx="8" cy="6" r="2" fill={dot} />
    </svg>
  )
}

// ── OpenStreetMap ─────────────────────────────────────────────────────────────
// Brand colour: OSM green (#52A84E)
function OpenStreetMapIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return <PinIcon fill="#52A84E" dot="#ffffff" className={className} ariaLabel={ariaLabel} />
}

// ── Google Maps ───────────────────────────────────────────────────────────────
// Brand colour: Google Maps red (#EA4335); white inner dot
function GoogleMapsIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return <PinIcon fill="#EA4335" dot="#ffffff" className={className} ariaLabel={ariaLabel} />
}

// ── Bing Maps ─────────────────────────────────────────────────────────────────
// Brand colour: Microsoft blue (#0078D7); white inner dot
function BingMapsIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return <PinIcon fill="#0078D7" dot="#ffffff" className={className} ariaLabel={ariaLabel} />
}

// ── Apple Maps ────────────────────────────────────────────────────────────────
// Brand colour: Apple Maps red (#FF3B30); white inner dot
function AppleMapsIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return <PinIcon fill="#FF3B30" dot="#ffffff" className={className} ariaLabel={ariaLabel} />
}

// ── Public entry point ────────────────────────────────────────────────────────

export default function MapProviderIcon({ providerId, className = 'w-4 h-4', ariaLabel }: MapProviderIconProps) {
  switch (providerId) {
    case 'google':
      return <GoogleMapsIcon className={className} ariaLabel={ariaLabel} />
    case 'bing':
      return <BingMapsIcon className={className} ariaLabel={ariaLabel} />
    case 'apple':
      return <AppleMapsIcon className={className} ariaLabel={ariaLabel} />
    case 'openstreetmap':
    default:
      return <OpenStreetMapIcon className={className} ariaLabel={ariaLabel} />
  }
}
