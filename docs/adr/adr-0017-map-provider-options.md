---
post_title: "ADR-0017: Alternative Map Provider Options"
author1: "techie2000"
post_slug: "adr-0017-map-provider-options"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["frontend"]
tags: ["adr", "frontend", "maps", "ux", "preferences"]
ai_note: "AI-assisted draft based on repository state and user request."
summary: >-
  Records the decision to support four map providers (OpenStreetMap, Google Maps,
  Bing Maps, Apple Maps) via simple deep-link URLs, the acceptable-use findings
  for each provider, and the UX design for user preference management and
  repeated-use detection.
post_date: "2026-03-31"
title: "ADR-0017: Alternative Map Provider Options"
status: "Accepted"
date: "2026-03-31"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

The LEI Records detail modal shows a **"View on Map"** link for entity addresses
(legal address and HQ address). The initial implementation opened
[OpenStreetMap](https://www.openstreetmap.org/) unconditionally.

Issue #243 requests support for additional map providers (Google Maps, Bing Maps,
Apple Maps) so that users can work with the mapping tool they prefer.
It also requires:

- Recording the acceptable-use findings for each provider.
- A user preference to set the default map provider.
- A dropdown on the "View on Map" control allowing one-click access to any provider.
- Automatic detection of repeated alternative-provider use and a prompt to update
  the stored default.

## Decision Drivers

- Users have existing workflows and preferences around specific map applications.
- Any solution must comply with each provider's terms of service.
- The implementation should be consistent with the existing user-preference system
  (ADR-0011) and the `PreferenceSavePrompt` UX pattern already used throughout
  the frontend.
- No additional API keys, SDKs, or backend changes should be required.

## Acceptable-Use Findings

All four providers explicitly permit simple deep-link URLs that open in the user's
browser or native application. These are **user-navigated links** — the user
actively clicks to leave the Axiom UI and open a third-party service — which is
distinct from embedding a map widget or making server-side API calls.

### OpenStreetMap

- **URL pattern**: `https://www.openstreetmap.org/search?query={encoded_address}`
- **Licence**: Map data is © OpenStreetMap contributors under
  [ODbL](https://www.openstreetmap.org/copyright). Plain navigational links to the
  OSM web interface are unrestricted.
- **Finding**: ✅ Permitted without restrictions, attribution, or registration.

### Google Maps

- **URL pattern**: `https://www.google.com/maps/search/?api=1&query={encoded_address}`
- **Reference**: [Google Maps URLs developer guide](https://developers.google.com/maps/documentation/urls/get-started)
- **Finding**: ✅ Google explicitly documents these "universal cross-platform URLs"
  for linking users to Google Maps. No API key or billing account is required for
  plain URL links. Attribution is not required because the user is navigating to
  Google's own site.

### Bing Maps

- **URL pattern**: `https://www.bing.com/maps?q={encoded_address}`
- **Reference**: [Bing Maps URL API](https://learn.microsoft.com/en-us/bingmaps/articles/create-a-custom-map-url)
- **Finding**: ✅ Microsoft documents plain URL deep-links as a supported mechanism.
  No API key or attribution is required for simple search links.

### Apple Maps

- **URL pattern**: `https://maps.apple.com/?q={encoded_address}`
- **Reference**: [Apple Maps web links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html)
- **Finding**: ✅ Apple documents `maps.apple.com` web links for user-initiated map
  navigation. On Apple platforms the link opens the native Maps app; on other
  platforms it opens a web view. No API key or attribution is required.

**Summary**: All four providers permit simple navigational deep-link URLs.
No licensing, registration, or attribution obligations apply to Axiom.

## Options Considered

### Option 1: Extend existing "View on Map" button to support multiple providers

Replace the single hardcoded OpenStreetMap link with:

- A main "View on Map" button that opens the user's **preferred provider**.
- A small chevron (▾) button that opens a dropdown listing all four providers.
- A `global/map_provider` preference (string) stored via the existing
  `useUserPreference` hook.
- A map provider selector in the **Global Preferences** panel (`UserBadge`).
- Session-based usage tracking: when a user opens an alternative provider
  ≥ 3 times, show a `PreferenceSavePrompt` suggesting they update their default.

**Pros:**

- Consistent with existing preference patterns (ADR-0011, `useDeferredBooleanPreference`).
- No backend changes required.
- Reuses `PreferenceSavePrompt` for the repeated-use UX.
- Providers are abstracted in a dedicated `map-providers.ts` utility — easy to
  add or remove providers later.

**Cons:**

- The chevron button adds a small amount of visual complexity to the address rows.

### Option 2: Show all four links unconditionally

Render four separate "View on X" links for every address.

**Pros:** Extremely simple to implement.

**Cons:**

- Clutters the modal with duplicate links.
- Does not fulfil the preference/default requirement from the issue.

### Option 3: Right-click native context menu

Intercept `contextmenu` events and display a custom overlay.

**Pros:** Feels like a "right-click context menu" as described in the issue.

**Cons:**

- Overriding the native context menu is hostile to accessibility (screen readers,
  keyboard users) and clashes with browser/OS-level menus.
- Different rendering behaviour across browsers and devices.
- Hard to make accessible and keyboard-navigable.

## Decision Outcome

**Chosen Option: Option 1** — dropdown chevron alongside the "View on Map" button.

The native right-click context menu approach (Option 3) was ruled out because it
breaks accessibility and browser conventions. A small accessible dropdown (Option 1)
achieves the same discoverability and satisfies the issue requirement to "allow a
right-click option to select one of the alternative map providers" without the
downsides.

### Rationale

- Fits seamlessly into the existing preference infrastructure.
- The `MapLink` component is self-contained and reusable across any future page
  that displays addresses.
- Repeated-use detection (session-storage counters) is lightweight and privacy-safe
  (data never leaves the browser).
- The `map-providers.ts` utility cleanly separates URL-building logic and is fully
  unit-tested.

### Trade-offs Accepted

- The dropdown chevron adds a small UI element; this is mitigated by keeping it
  compact and adjacent to the existing button text.
- The repeated-use threshold (3 clicks) is a heuristic. It can be tuned in
  `MapLink.tsx` (`REPEATED_USE_THRESHOLD`) without an ADR amendment.

## Consequences

### Positive

- Users can open addresses in their preferred map application with one click.
- The preference persists across sessions via the server-backed preference store.
- All four providers' acceptable-use requirements are satisfied; findings are
  recorded in this ADR and in `map-providers.ts`.

### Negative

- An additional preference key (`global/map_provider`) is added to the user
  preference store.

### Mitigation

- The preference key uses the existing `global` page key (same as `theme` and
  `dark_mode`), so no schema changes are required.

## Implementation Notes

| File | Purpose |
| ---- | ------- |
| `frontend/app/lib/map-providers.ts` | Provider definitions, URL builders, acceptable-use documentation |
| `frontend/app/lib/map-providers.test.ts` | Unit tests for URL builders |
| `frontend/app/components/MapLink.tsx` | "View on Map" button + dropdown + repeated-use prompt |
| `frontend/app/components/UserBadge.tsx` | Map provider selector in Global Preferences panel |
| `frontend/app/lei-records/page.tsx` | Replaced inline map buttons with `<MapLink>` |
| `frontend/public/locales/en/common.json` | New `mapProvider.*` and `preferences.mapProvider*` i18n keys |

## References

- [Google Maps URL documentation](https://developers.google.com/maps/documentation/urls/get-started)
- [Bing Maps URL API](https://learn.microsoft.com/en-us/bingmaps/articles/create-a-custom-map-url)
- [Apple Maps web links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html)
- [OpenStreetMap copyright](https://www.openstreetmap.org/copyright)
- [ADR-0011: Per-User UI Preferences Persisted to Database](adr-0011-user-preferences.md)

## Revision History

- **2026-03-31**: Initial decision
