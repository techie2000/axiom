// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildRegistrationLookupOptions,
  buildRegistrationLookupUrl,
  openRegistrationLookup,
  RegistrationLookupOption,
} from './ra-lookup'

describe('buildRegistrationLookupUrl', () => {
  it('substitutes the registration number into the template', () => {
    const result = buildRegistrationLookupUrl(
      'https://find-and-update.company-information.service.gov.uk/company/{registration_number}',
      '17027441'
    )
    expect(result).toBe(
      'https://find-and-update.company-information.service.gov.uk/company/17027441'
    )
  })

  it('URL-encodes the registration number', () => {
    const result = buildRegistrationLookupUrl(
      'https://example.com/search?q={registration_number}',
      'AB 123/456'
    )
    expect(result).toBe('https://example.com/search?q=AB%20123%2F456')
  })

  it('returns null when the template is empty', () => {
    expect(buildRegistrationLookupUrl('', '17027441')).toBeNull()
  })

  it('returns null when the template is null', () => {
    expect(buildRegistrationLookupUrl(null, '17027441')).toBeNull()
  })

  it('returns null when the template is undefined', () => {
    expect(buildRegistrationLookupUrl(undefined, '17027441')).toBeNull()
  })

  it('returns null when the registration number is empty', () => {
    expect(buildRegistrationLookupUrl('https://example.com/{registration_number}', '')).toBeNull()
  })

  it('returns null when the registration number is null', () => {
    expect(buildRegistrationLookupUrl('https://example.com/{registration_number}', null)).toBeNull()
  })

  it('returns null when the registration number is undefined', () => {
    expect(buildRegistrationLookupUrl('https://example.com/{registration_number}', undefined)).toBeNull()
  })

  it('handles templates without the placeholder (passes through unchanged)', () => {
    const result = buildRegistrationLookupUrl('https://example.com/list', '12345')
    expect(result).toBe('https://example.com/list')
  })

  it('handles multiple placeholder occurrences', () => {
    const result = buildRegistrationLookupUrl(
      'https://example.com/q={registration_number}&id={registration_number}',
      '99'
    )
    // replaceAll replaces every occurrence for safety
    expect(result).toBe('https://example.com/q=99&id=99')
  })

  it('substitutes {lang} using the provided language base code', () => {
    const result = buildRegistrationLookupUrl(
      'https://example.com/search?lang={lang}&id={registration_number}',
      '0712691464',
      'fr-BE'
    )
    expect(result).toBe('https://example.com/search?lang=fr&id=0712691464')
  })

  it('defaults {lang} to en when language is omitted', () => {
    const result = buildRegistrationLookupUrl(
      'https://example.com/search?lang={lang}&id={registration_number}',
      '0712691464'
    )
    expect(result).toBe('https://example.com/search?lang=en&id=0712691464')
  })
})

describe('buildRegistrationLookupOptions', () => {
  it('builds standard URL options for non-Sunbiz authorities', () => {
    const options = buildRegistrationLookupOptions(
      'RA000585',
      [{ name: 'UK Companies House', url: 'https://example.com/company/{registration_number}' }],
      '12345'
    )

    expect(options).toEqual([
      {
        key: 'UK Companies House:https://example.com/company/12345',
        label: 'UK Companies House',
        type: 'url',
        url: 'https://example.com/company/12345',
      },
    ])
  })

  it('builds Sunbiz post option for RA000603', () => {
    const options = buildRegistrationLookupOptions(
      'RA000603',
      [{ name: 'Sunbiz (FL) By Document Number', url: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber?DocumentNumber={registration_number}' }],
      'L24000116074'
    )

    expect(options).toEqual([
      {
        key: 'Sunbiz (FL) By Document Number:L24000116074:sunbiz-post',
        label: 'Sunbiz (FL) By Document Number',
        type: 'sunbiz-document-number-post',
        formAction: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber',
        documentNumber: 'L24000116074',
      },
    ])
  })

  it('builds Belgium KBO lookup URL with language placeholder expansion', () => {
    const options = buildRegistrationLookupOptions(
      'RA000025',
      [{
        name: 'KBO (Belgium)',
        url: 'https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?lang={lang}&nummer={registration_number}',
      }],
      '0712691464',
      'nl-BE'
    )

    expect(options).toEqual([
      {
        key: 'KBO (Belgium):https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?lang=nl&nummer=0712691464',
        label: 'KBO (Belgium)',
        type: 'url',
        url: 'https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?lang=nl&nummer=0712691464',
      },
    ])
  })
})

describe('openRegistrationLookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens standard URL lookups in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const option: RegistrationLookupOption = {
      key: 'standard',
      label: 'Standard',
      type: 'url',
      url: 'https://example.com/item/1',
    }

    openRegistrationLookup(option)

    expect(openSpy).toHaveBeenCalledWith('https://example.com/item/1', '_blank', 'noopener,noreferrer')
  })

  it('opens a blank tab first for Sunbiz post lookups', () => {
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
    const popupDocument = document.implementation.createHTMLDocument('popup')
    const popupStub = { document: popupDocument, opener: {} } as unknown as Window
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => popupStub)

    const option: RegistrationLookupOption = {
      key: 'sunbiz',
      label: 'Sunbiz',
      type: 'sunbiz-document-number-post',
      formAction: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber',
      documentNumber: 'L24000116074',
    }

    openRegistrationLookup(option)

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank')
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(popupStub.opener).toBeNull()

    const submittedForm = popupDocument.querySelector('form')
    expect(submittedForm?.getAttribute('method')).toBe('POST')
    expect(submittedForm?.getAttribute('action')).toBe(
      'https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber'
    )
    expect((popupDocument.querySelector('input[name="SearchTerm"]') as HTMLInputElement | null)?.value).toBe('L24000116074')
    expect((popupDocument.querySelector('input[name="InquiryType"]') as HTMLInputElement | null)?.value).toBe('DocumentNumber')
    expect((popupDocument.querySelector('input[name="SearchNameOrder"]') as HTMLInputElement | null)?.value).toBe('')
  })

  it('builds Texas taxpayer lookup option for RA000637', () => {
    const options = buildRegistrationLookupOptions(
      'RA000637',
      [{ name: 'Texas Comptroller Franchise Status', url: 'https://comptroller.texas.gov/data-search/franchise-tax?fileNumber={registration_number}' }],
      '0702886022'
    )

    expect(options).toEqual([
      {
        key: 'Texas Comptroller Franchise Status:0702886022:texas-fetch',
        label: 'Texas Comptroller Franchise Status',
        type: 'texas-franchise-file-number-fetch',
        searchApiUrl: 'https://comptroller.texas.gov/data-search/franchise-tax?fileNumber=0702886022',
        fallbackUrl: 'https://comptroller.texas.gov/taxes/franchise/account-status/search',
      },
    ])
  })

  it('resolves Texas taxpayer number and opens the detail URL', async () => {
    const popupStub = { location: { href: '' } } as unknown as Window
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => popupStub)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ taxpayerId: '12329555804' }],
        count: 1,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const option: RegistrationLookupOption = {
      key: 'texas',
      label: 'Texas Comptroller Franchise Status',
      type: 'texas-franchise-file-number-fetch',
      searchApiUrl: 'https://comptroller.texas.gov/data-search/franchise-tax?fileNumber=0702886022',
      fallbackUrl: 'https://comptroller.texas.gov/taxes/franchise/account-status/search',
    }

    openRegistrationLookup(option)
    await Promise.resolve()
    await Promise.resolve()

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank')
    expect(fetchMock).toHaveBeenCalledWith('https://comptroller.texas.gov/data-search/franchise-tax?fileNumber=0702886022')
    expect(popupStub.location.href).toBe('https://comptroller.texas.gov/taxes/franchise/account-status/search/12329555804')
  })

  it('falls back to the Texas search page when the taxpayer number is missing', async () => {
    const popupStub = { location: { href: '' } } as unknown as Window
    vi.spyOn(window, 'open').mockImplementation(() => popupStub)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], count: 0 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const option: RegistrationLookupOption = {
      key: 'texas-fallback',
      label: 'Texas Comptroller Franchise Status',
      type: 'texas-franchise-file-number-fetch',
      searchApiUrl: 'https://comptroller.texas.gov/data-search/franchise-tax?fileNumber=0702886022',
      fallbackUrl: 'https://comptroller.texas.gov/taxes/franchise/account-status/search',
    }

    openRegistrationLookup(option)
    await Promise.resolve()
    await Promise.resolve()

    expect(popupStub.location.href).toBe('https://comptroller.texas.gov/taxes/franchise/account-status/search')
  })
})
