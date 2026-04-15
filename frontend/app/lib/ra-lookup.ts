/**
 * Builds a registration authority lookup URL by substituting the registration
 * number (and optionally a language code) into a URL template loaded from
 * /data/ra-urls.json.
 *
 * @param urlTemplate - Template string containing `{registration_number}` and
 *                      optionally `{registration_number_digits}`/`{lang}` placeholders
 * @param registrationNumber - The registration number to substitute
 * @param lang - BCP 47 language tag (e.g. 'nl', 'fr', 'de'). When the template
 *               contains `{lang}`, the base subtag (everything before the first
 *               '-') is used. Defaults to 'en' when omitted.
 * @returns The resolved URL, or null if either argument is empty
 */
export function buildRegistrationLookupUrl(
  urlTemplate: string | undefined | null,
  registrationNumber: string | undefined | null,
  lang?: string
): string | null {
  if (!urlTemplate || !registrationNumber) return null

  const registrationNumberAsText = String(registrationNumber)
  const registrationNumberDigits = registrationNumberAsText.replace(/\D+/g, '')
  const baseLang = String(lang || 'en').split('-')[0].trim().toLowerCase()
  const safeLang = /^[a-z]{2,3}$/.test(baseLang) ? baseLang : 'en'

  return urlTemplate
    .replaceAll('{registration_number}', encodeURIComponent(registrationNumberAsText))
    .replaceAll('{registration_number_digits}', encodeURIComponent(registrationNumberDigits))
    .replaceAll('{lang}', encodeURIComponent(safeLang))
}

export interface RegistrationLookupTemplate {
  name: string
  url: string
}

export interface RegistrationLookupOption {
  key: string
  label: string
  type: 'url' | 'sunbiz-document-number-post' | 'texas-franchise-file-number-fetch'
  url?: string
  formAction?: string
  documentNumber?: string
  searchApiUrl?: string
  fallbackUrl?: string
}

const SUNBIZ_DOCUMENT_NUMBER_PATH = '/Inquiry/CorporationSearch/ByDocumentNumber'
const TEXAS_FRANCHISE_SEARCH_PATH = '/data-search/franchise-tax'
const TEXAS_FRANCHISE_SEARCH_PAGE_URL = 'https://comptroller.texas.gov/taxes/franchise/account-status/search'
const TEXAS_FRANCHISE_DETAIL_URL_PREFIX = `${TEXAS_FRANCHISE_SEARCH_PAGE_URL}/`
const BELGIUM_NATIONAL_GAZETTE_HOSTNAME = 'www.ejustice.just.fgov.be'
const REGISTRY_LANGUAGE_ALLOWLIST: Record<string, Set<string>> = {
  // Belgium KBO supports en/nl/fr/de (issue #302).
  RA000025: new Set(['en', 'nl', 'fr', 'de']),
  // Switzerland UID optional language support from issue #281 comment.
  RA000548: new Set(['en', 'fr', 'it', 'de']),
}

function normalizeBaseLanguage(lang?: string): string {
  const baseLang = lang ? lang.split('-')[0].toLowerCase() : 'en'
  return /^[a-z]{2,3}$/.test(baseLang) ? baseLang : 'en'
}

function resolveLookupLanguage(raCode: string, lang?: string): string {
  const normalizedLang = normalizeBaseLanguage(lang)
  const allowlist = REGISTRY_LANGUAGE_ALLOWLIST[raCode]
  if (!allowlist) return normalizedLang
  return allowlist.has(normalizedLang) ? normalizedLang : 'en'
}

function resolveLookupLanguageForTemplate(raCode: string, templateUrl: string, lang?: string): string {
  const normalizedLang = normalizeBaseLanguage(lang)

  // National Gazette only accepts NL/FR/DE, with NL as default.
  if (raCode === 'RA000025') {
    try {
      const parsed = new URL(templateUrl)
      if (parsed.hostname === BELGIUM_NATIONAL_GAZETTE_HOSTNAME) {
        return ['nl', 'fr', 'de'].includes(normalizedLang) ? normalizedLang : 'nl'
      }
    } catch {
      // Fall back to RA-level rules below.
    }
  }

  return resolveLookupLanguage(raCode, normalizedLang)
}

function isSunbizDocumentLookup(raCode: string, templateUrl: string): boolean {
  if (raCode === 'RA000603') return true
  try {
    const parsed = new URL(templateUrl)
    return parsed.hostname === 'search.sunbiz.org' && parsed.pathname === SUNBIZ_DOCUMENT_NUMBER_PATH
  } catch {
    return false
  }
}

function isTexasFranchiseFileNumberLookup(raCode: string, templateUrl: string): boolean {
  if (raCode === 'RA000637') return true
  try {
    const parsed = new URL(templateUrl)
    return parsed.hostname === 'comptroller.texas.gov' && parsed.pathname === TEXAS_FRANCHISE_SEARCH_PATH
  } catch {
    return false
  }
}

export function buildRegistrationLookupOptions(
  raCode: string | undefined | null,
  templates: RegistrationLookupTemplate[],
  registrationNumber: string | undefined | null,
  lang?: string
): RegistrationLookupOption[] {
  if (!registrationNumber || !raCode) return []

  const trimmedRegistrationNumber = String(registrationNumber).trim()
  if (!trimmedRegistrationNumber) return []

  return templates.flatMap<RegistrationLookupOption>(template => {
    const resolvedLanguage = resolveLookupLanguageForTemplate(
      raCode,
      template.url,
      String(lang || 'en')
    )

    if (isSunbizDocumentLookup(raCode, template.url)) {
      return [{
        key: `${template.name}:${trimmedRegistrationNumber}:sunbiz-post`,
        label: template.name,
        type: 'sunbiz-document-number-post',
        formAction: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber',
        documentNumber: trimmedRegistrationNumber,
      }]
    }

    if (isTexasFranchiseFileNumberLookup(raCode, template.url)) {
      const searchApiUrl = buildRegistrationLookupUrl(template.url, trimmedRegistrationNumber, resolvedLanguage)
      if (!searchApiUrl) return []

      return [{
        key: `${template.name}:${trimmedRegistrationNumber}:texas-fetch`,
        label: template.name,
        type: 'texas-franchise-file-number-fetch',
        searchApiUrl,
        fallbackUrl: TEXAS_FRANCHISE_SEARCH_PAGE_URL,
      }]
    }

    const resolvedUrl = buildRegistrationLookupUrl(template.url, trimmedRegistrationNumber, resolvedLanguage)
    if (!resolvedUrl) return []

    return [{
      key: `${template.name}:${resolvedUrl}`,
      label: template.name,
      type: 'url',
      url: resolvedUrl,
    }]
  })
}

function submitSunbizDocumentLookup(formAction: string, documentNumber: string): void {
  const popup = window.open('about:blank', '_blank')
  if (!popup) return

  popup.opener = null

  const doc = popup.document
  doc.title = 'Opening registration lookup...'

  const form = doc.createElement('form')
  form.method = 'POST'
  form.action = formAction

  const searchTermInput = doc.createElement('input')
  searchTermInput.type = 'hidden'
  searchTermInput.name = 'SearchTerm'
  searchTermInput.value = documentNumber
  form.appendChild(searchTermInput)

  const inquiryTypeInput = doc.createElement('input')
  inquiryTypeInput.type = 'hidden'
  inquiryTypeInput.name = 'InquiryType'
  inquiryTypeInput.value = 'DocumentNumber'
  form.appendChild(inquiryTypeInput)

  const searchNameOrderInput = doc.createElement('input')
  searchNameOrderInput.type = 'hidden'
  searchNameOrderInput.name = 'SearchNameOrder'
  searchNameOrderInput.value = ''
  form.appendChild(searchNameOrderInput)

  doc.body.appendChild(form)
  form.submit()
}

interface TexasFranchiseSearchResponse {
  success?: boolean
  data?: Array<{
    taxpayerId?: string
  }>
}

async function resolveTexasFranchiseLookup(option: RegistrationLookupOption): Promise<void> {
  const popup = window.open('about:blank', '_blank')
  if (!popup) return

  // Drop opener access while preserving a usable handle for async navigation.
  popup.opener = null

  if (!option.searchApiUrl) {
    popup.location.href = option.fallbackUrl ?? TEXAS_FRANCHISE_SEARCH_PAGE_URL
    return
  }

  try {
    const response = await fetch(option.searchApiUrl)
    if (!response.ok) throw new Error(`Texas lookup failed with status ${response.status}`)

    const payload = await response.json() as TexasFranchiseSearchResponse
    const taxpayerId = payload.data?.find(record => record.taxpayerId)?.taxpayerId

    popup.location.href = taxpayerId
      ? `${TEXAS_FRANCHISE_DETAIL_URL_PREFIX}${encodeURIComponent(taxpayerId)}`
      : (option.fallbackUrl ?? TEXAS_FRANCHISE_SEARCH_PAGE_URL)
  } catch {
    popup.location.href = option.fallbackUrl ?? TEXAS_FRANCHISE_SEARCH_PAGE_URL
  }
}

export function openRegistrationLookup(option: RegistrationLookupOption): void {
  if (typeof window === 'undefined') return

  if (option.type === 'sunbiz-document-number-post') {
    if (!option.formAction || !option.documentNumber) return
    submitSunbizDocumentLookup(option.formAction, option.documentNumber)
    return
  }

  if (option.type === 'texas-franchise-file-number-fetch') {
    void resolveTexasFranchiseLookup(option)
    return
  }

  if (!option.url) return
  window.open(option.url, '_blank', 'noopener,noreferrer')
}
