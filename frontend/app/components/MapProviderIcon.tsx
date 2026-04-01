/**
 * MapProviderIcon renders each provider's recognised brand logo as an inline SVG.
 *
 * The brand names, colours, and marks remain the intellectual property of their
 * respective owners and are used here solely to identify the map service to the
 * end user (descriptive / trademark fair use).
 *
 * Sources:
 *  • OpenStreetMap  – Simple Icons (simpleicons.org, CC0), slug "openstreetmap",
 *                     brand colour #7EBC6F
 *  • Google Maps    – Wikimedia Commons, File:Google_Maps_Logo_2020.svg; pin portion
 *                     extracted; brand colours: #4285F4, #34A853, #FBBC04, #EA4335,
 *                     #1A73E8
 *  • Apple (Maps)   – Simple Icons (simpleicons.org, CC0), slug "apple",
 *                     tinted #FF3B30 (Apple Maps red)
 *  • Bing Maps      – Wikimedia Commons, File:Bing_favicon.svg; teal #0C8484 background
 *                     with white mark
 */

import { MapProviderId } from '../lib/map-providers'

interface MapProviderIconProps {
  providerId: MapProviderId
  /** Tailwind / inline size class – defaults to "w-4 h-4" */
  className?: string
  /** aria-label for the icon element (should be provided by the parent, so defaults to "" to hide from AT) */
  ariaLabel?: string
}

// ── Shared SVG wrapper ────────────────────────────────────────────────────────

function BrandIcon({
  viewBox,
  fill,
  d,
  className = 'w-4 h-4',
  ariaLabel = '',
  children,
}: {
  viewBox: string
  fill: string
  d?: string
  className?: string
  ariaLabel?: string
  children?: React.ReactNode
}) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      aria-hidden={ariaLabel ? undefined : 'true'}
      aria-label={ariaLabel || undefined}
      role={ariaLabel ? 'img' : undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      {d && <path fill={fill} d={d} />}
      {children}
    </svg>
  )
}

// ── OpenStreetMap ─────────────────────────────────────────────────────────────
// Source: simpleicons.org / slug "openstreetmap" / CC0
// Brand colour: #7EBC6F
// prettier-ignore
const OSM_PATH = `M2.672 23.969c-.352-.089-.534-.234-1.471-1.168C.085 21.688.014 21.579.018 20.999
c0-.645-.196-.414 3.368-3.986 3.6-3.608 3.415-3.451 4.064-3.449.302 0 .378.016.62.14l.277.14 1.744-1.744
-.218-.343c-.425-.662-.825-1.629-1.006-2.429a7.657 7.657 0 0 1 1.479-6.44c2.49-3.12 6.959-3.812 10.26-1.588
1.812 1.218 2.99 3.099 3.328 5.314.07.467.07 1.579 0 2.074a7.554 7.554 0 0 1-2.205 4.402
6.712 6.712 0 0 1-1.943 1.401c-.959.483-1.775.71-2.881.803-1.573.131-3.32-.305-4.656-1.163l-.343-.218
-1.744 1.744.14.28c.125.241.14.316.14.617.003.651.156.467-3.426 4.049-2.761 2.756-3.186 3.164-3.398
3.261-.271.125-.69.171-.945.106zM17.485 13.95a6.425 6.425 0 0 0 4.603-3.51c1.391-2.899.455-6.306
-2.227-8.108-.638-.43-1.529-.794-2.367-.962-.581-.117-1.809-.104-2.414.025a6.593 6.593 0 0 0-2.452
1.064c-.444.315-1.177 1.048-1.487 1.487a6.384 6.384 0 0 0 .38 7.907 6.406 6.406 0 0 0 3.901
2.136c.509.078 1.542.058 2.065-.037zm-3.738 7.376a80.97 80.97 0 0 1-2.196-.651c-.025-.028
1.207-4.396 1.257-4.449.023-.026 4.242 1.152 4.414 1.236.062.026-.003.288-.525 2.102a398.513 398.513 0 0
0-.635 2.236c-.025.087-.069.156-.097.156-.028-.003-1.028-.287-2.219-.631zm2.912.524c0-.053 1.227-4.333
1.246-4.347.047-.034 4.324-1.23 4.341-1.211.019.019-1.199 4.337-1.23 4.36-.02.019-4.126 1.191-4.259
1.218-.054.011-.098 0-.098-.019zm-7.105-1.911c.846-.852 1.599-1.627 1.674-1.728.171-.218.405-.732.472
-1.015.026-.118.053-.352.058-.522l.011-.307.182-.051c.103-.028.193-.044.202-.034.023.025-1.207 4.321
-1.246 4.36-.02.016-.677.213-1.464.436l-1.425.405 1.537-1.542zm8.289-3.06a1.371 1.371 0 0 1-.059-.187
l-.044-.156.156-.028c1.339-.227 2.776-.856 3.908-1.713.16-.125.252-.171.265-.134.054.165.272.95.265.959
-.034.034-4.48 1.282-4.492 1.261zm-15.083-1.3c-.05-.039-1.179-3.866-1.264-4.29-.016-.084.146-.044
2.174.536 2.121.604 2.192.629 2.222.74.028.098.011.129-.125.223-.084.059-.769.724-1.523 1.479a63.877
63.877 0 0 1-1.39 1.367c-.016 0-.056-.025-.093-.054zm.821-4.378c-1.188-.343-2.164-.623-2.167-.626
-.016-.012 1.261-4.433 1.285-4.46.022-.022 4.422 1.211 4.469 1.252.009.009-.269 1.017-.618 2.239-.576
2.02-.643 2.224-.723 2.22-.05-.003-1.059-.285-2.247-.626zm2.959.538c.012-.031.212-.723.444-1.534l.42
-1.476.056.321c.093.556.265 1.188.464 1.741.106.296.187.539.181.545-.008.006-.332.101-.719.212-.389.109
-.741.21-.786.224-.058.016-.075.006-.059-.034zM4.905 6.112c-1.187-.339-2.167-.635-2.18-.654-.04-.062
-1.246-4.321-1.23-4.338.026-.025 4.31 1.204 4.351 1.246.047.051 1.28 4.379 1.246 4.376L4.91 6.113zm
2.148-1.713l-.519-1.806-.078-.28 1.693-.483c.934-.265 1.724-.495 1.76-.508.034-.016-.083.14-.26.336
A8.729 8.729 0 0 0 7.69 5.23a4.348 4.348 0 0 0-.132.561c0 .293-.115-.025-.505-1.39z`

function OpenStreetMapIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return <BrandIcon viewBox="0 0 24 24" fill="#7EBC6F" d={OSM_PATH} className={className} ariaLabel={ariaLabel} />
}

// ── Google Maps ───────────────────────────────────────────────────────────────
// Source: Wikimedia Commons, File:Google_Maps_Logo_2020.svg (trademark fair use)
// Pin portion extracted from the full logo SVG; bounding box x≈580–1458, y≈0–1228.
// viewBox trimmed to contain only the coloured pin mark.
// Brand colours: #4285F4 blue, #34A853 green, #FBBC04 yellow, #EA4335 red, #1A73E8 dark blue.

function GoogleMapsIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return (
    <BrandIcon viewBox="580 0 878 1240" fill="" className={className} ariaLabel={ariaLabel}>
      {/* Green – south/lower section of globe mark */}
      <path
        d="M831 909.9c37.9 47.4 76.5 107 96.7 143 24.6 46.8 34.8 78.4 53.1 135 10.7 31 20.9 40.4 42.3 40.4 23.4 0 34.1-15.8 42.3-40.4 17.1-53.1 30.3-93.5 51.2-132 80.6-152 212-260 286-408 0 0 48.7-90.4 48.7-217 0-118-48-200-48-200l-572 680z"
        fill="#34a853"
      />
      {/* Yellow – eastern section */}
      <path
        d="M637 631.9c46.1 105 134 197 194 278l318-377s-44.9 58.8-126 58.8c-90.4 0-164-72-164-163 0-62.6 37.3-106 37.3-106-234 34.8-221 91.5-260 309z"
        fill="#fbbc04"
      />
      {/* Blue – top section */}
      <path
        d="M1153 19.6c106 34.1 196 106 250 211l-254 303s37.3-43.6 37.3-106c0-92.9-78.4-163-163-163-80.3 0-126 58.1-126 58.1 19.5-44.4 221-288 256-303z"
        fill="#4285f4"
      />
      {/* Dark blue – upper left */}
      <path
        d="M695 152.9c63.2-75.2 174-153 327-153 73.9 0 130 19.6 130 19.6l-255 303c-17.2-9.33-185-140-202-170z"
        fill="#1a73e8"
      />
      {/* Red – western section */}
      <path
        d="M637 631.9s-41.7-82.8-41.7-202c0-113 44.2-212 100-276l202 170-260 308z"
        fill="#ea4335"
      />
    </BrandIcon>
  )
}

// ── Apple Maps ────────────────────────────────────────────────────────────────
// Source: simpleicons.org / slug "apple" / CC0  — coloured with Apple Maps red
// Brand colour: #FF3B30 (iOS Maps app accent)
// prettier-ignore
const APPLE_PATH = `M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014
-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987
1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415
-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376
-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532
1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701`

function AppleMapsIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return <BrandIcon viewBox="0 0 24 24" fill="#FF3B30" d={APPLE_PATH} className={className} ariaLabel={ariaLabel} />
}

// ── Bing Maps ─────────────────────────────────────────────────────────────────
// Source: Wikimedia Commons, File:Bing_favicon.svg (trademark fair use)
// The actual Bing favicon: teal (#0C8484) background with white "B" mark.
// viewBox matches the source: "0 0 32 32"

function BingMapsIcon({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return (
    <BrandIcon viewBox="0 0 32 32" fill="" className={className} ariaLabel={ariaLabel}>
      {/* Teal background */}
      <path d="M 0,0 H 32 V 32 H 0 Z" fill="#0c8484" />
      {/* Bing "B" mark in white – path from Wikimedia Commons Bing_favicon.svg */}
      <path
        d="m 6.777203,2.7889395 5.251356,1.8503537 V 23.129801 l 7.401414,-4.274057 -3.629039,-1.700501 -2.286881,-5.694399 11.655925,4.098143 v 5.955012 L 12.028559,29.091328 6.770688,26.165945 V 2.7889395 Z"
        fill="#ffffff"
      />
    </BrandIcon>
  )
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
