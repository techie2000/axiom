'use client'

import { useMemo, useState } from 'react'
import { getCountryFlagEmoji } from '../lib/country-flag'

interface CountryFlagProps {
  countryCode?: string | null
  className?: string
  title?: string
}

const TWEMOJI_BASE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg'

const isAlpha2Code = (value: string) => /^[A-Z]{2}$/.test(value)

const toTwemojiFlagUrl = (countryCode: string) => {
  const base = 127397
  const codePoints = Array.from(countryCode).map((char) => (base + char.charCodeAt(0)).toString(16))
  return `${TWEMOJI_BASE_URL}/${codePoints.join('-')}.svg`
}

export default function CountryFlag({ countryCode, className, title }: CountryFlagProps) {
  const normalized = (countryCode || '').trim().toUpperCase()
  const [imageFailed, setImageFailed] = useState(false)

  const emoji = useMemo(() => getCountryFlagEmoji(normalized), [normalized])

  if (!isAlpha2Code(normalized)) {
    return <span className={className} title={title || 'N/A'}>—</span>
  }

  if (imageFailed) {
    return <span className={className} title={title || normalized}>{emoji}</span>
  }

  return (
    <img
      src={toTwemojiFlagUrl(normalized)}
      alt={`${normalized} flag`}
      title={title || normalized}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  )
}
