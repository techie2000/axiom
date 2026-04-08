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
  return urlTemplate.replaceAll('{registration_number}', encodeURIComponent(registrationNumber))
}

export interface RegistrationLookupTemplate {
  name: string
  url: string
}

export interface RegistrationLookupOption {
  key: string
  label: string
  type: 'url' | 'sunbiz-document-number-post'
  url?: string
  formAction?: string
  documentNumber?: string
}

const SUNBIZ_DOCUMENT_NUMBER_PATH = '/Inquiry/CorporationSearch/ByDocumentNumber'

function isSunbizDocumentLookup(raCode: string, templateUrl: string): boolean {
  if (raCode === 'RA000603') return true
  try {
    const parsed = new URL(templateUrl)
    return parsed.hostname === 'search.sunbiz.org' && parsed.pathname === SUNBIZ_DOCUMENT_NUMBER_PATH
  } catch {
    return false
  }
}

export function buildRegistrationLookupOptions(
  raCode: string | undefined | null,
  templates: RegistrationLookupTemplate[],
  registrationNumber: string | undefined | null
): RegistrationLookupOption[] {
  if (!registrationNumber || !raCode) return []

  const trimmedRegistrationNumber = String(registrationNumber).trim()
  if (!trimmedRegistrationNumber) return []

  return templates.flatMap<RegistrationLookupOption>(template => {
    if (isSunbizDocumentLookup(raCode, template.url)) {
      return [{
        key: `${template.name}:${trimmedRegistrationNumber}:sunbiz-post`,
        label: template.name,
        type: 'sunbiz-document-number-post',
        formAction: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber',
        documentNumber: trimmedRegistrationNumber,
      }]
    }

    const resolvedUrl = buildRegistrationLookupUrl(template.url, trimmedRegistrationNumber)
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

export function openRegistrationLookup(option: RegistrationLookupOption): void {
  if (typeof window === 'undefined') return

  if (option.type === 'sunbiz-document-number-post') {
    if (!option.formAction || !option.documentNumber) return
    submitSunbizDocumentLookup(option.formAction, option.documentNumber)
    return
  }

  if (!option.url) return
  window.open(option.url, '_blank', 'noopener,noreferrer')
}
