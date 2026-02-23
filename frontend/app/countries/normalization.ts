export interface Country {
  id: string
  code: string
  name: string
  alpha2: string
  alpha3: string
  numeric_code: string
  native_name: string
  continent: string
  capital: string
  region: string
  phone_codes: string[]
  currency_codes: string[]
  languages: string[]
  active: boolean
}

type CountryApiLike = Partial<{
  id: string
  code: string
  name: string
  alpha2: string
  alpha2_code: string
  alpha3: string
  alpha3_code: string
  numeric_code: string
  numeric: string | number
  native_name: string
  continent: string
  capital: string
  region: string
  phone_codes: string[] | string
  currency_codes: string[] | string
  languages: string[] | string
  active: boolean
}>

export interface CountriesDataQualitySummary {
  totalRows: number
  missingPrimaryAlpha2Rows: number
  missingSecondaryAlpha3Rows: number
}

const toSafeString = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toSafeString(item))
      .filter((item) => item.length > 0)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => toSafeString(item))
          .filter((item) => item.length > 0)
      }
    } catch {
      // Fall back to comma-separated string handling
    }

    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  return []
}

export const normalizeCountry = (country: CountryApiLike): Country => {
  const alpha2 = toSafeString(country.alpha2 || country.alpha2_code || country.code).toUpperCase()
  const alpha3 = toSafeString(country.alpha3 || country.alpha3_code).toUpperCase()
  const numeric = toSafeString(country.numeric_code || country.numeric)

  return {
    id: toSafeString(country.id) || alpha2 || toSafeString(country.name),
    code: toSafeString(country.code || alpha2).toUpperCase(),
    name: toSafeString(country.name),
    alpha2,
    alpha3,
    numeric_code: numeric,
    native_name: toSafeString(country.native_name),
    continent: toSafeString(country.continent),
    capital: toSafeString(country.capital),
    region: toSafeString(country.region),
    phone_codes: toStringArray(country.phone_codes),
    currency_codes: toStringArray(country.currency_codes),
    languages: toStringArray(country.languages),
    active: Boolean(country.active),
  }
}

export const normalizeCountriesPayload = (payload: unknown): Country[] => {
  if (!Array.isArray(payload)) return []

  return payload
    .map((country) => normalizeCountry((country || {}) as CountryApiLike))
    .filter((country) => country.name.length > 0)
}

export const summarizeCountriesDataQuality = (payload: unknown): CountriesDataQualitySummary => {
  if (!Array.isArray(payload)) {
    return {
      totalRows: 0,
      missingPrimaryAlpha2Rows: 0,
      missingSecondaryAlpha3Rows: 0,
    }
  }

  return payload.reduce<CountriesDataQualitySummary>(
    (summary, row) => {
      const country = (row || {}) as CountryApiLike

      const hasPrimaryAlpha2 =
        toSafeString(country.alpha2).length > 0 ||
        toSafeString(country.alpha2_code).length > 0 ||
        toSafeString(country.code).length > 0

      const hasSecondaryAlpha3 =
        toSafeString(country.alpha3).length > 0 ||
        toSafeString(country.alpha3_code).length > 0

      return {
        totalRows: summary.totalRows + 1,
        missingPrimaryAlpha2Rows: summary.missingPrimaryAlpha2Rows + (hasPrimaryAlpha2 ? 0 : 1),
        missingSecondaryAlpha3Rows: summary.missingSecondaryAlpha3Rows + (hasSecondaryAlpha3 ? 0 : 1),
      }
    },
    {
      totalRows: 0,
      missingPrimaryAlpha2Rows: 0,
      missingSecondaryAlpha3Rows: 0,
    }
  )
}
