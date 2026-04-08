/**
 * Builds a registration authority lookup URL by substituting the registration
 * number into a URL template loaded from /data/ra-urls.json.
 *
 * @param urlTemplate - Template string containing `{registration_number}` placeholder
 * @param registrationNumber - The registration number to substitute
 * @returns The resolved URL, or null if either argument is empty
 */
export function buildRegistrationLookupUrl(
  urlTemplate: string | undefined | null,
  registrationNumber: string | undefined | null
): string | null {
  if (!urlTemplate || !registrationNumber) return null
  return urlTemplate.replace('{registration_number}', encodeURIComponent(registrationNumber))
}
