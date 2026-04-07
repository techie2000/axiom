export function resolveHydrationSafeLabel(
  explicitLabel: string | undefined,
  hasHydrated: boolean,
  translatedLabel: string,
  fallbackLabel: string,
) {
  return explicitLabel ?? (hasHydrated ? translatedLabel : fallbackLabel)
}