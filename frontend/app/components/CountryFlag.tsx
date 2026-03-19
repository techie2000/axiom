'use client'

import React from 'react'
import Image from 'next/image'
import { useState } from 'react'
import { getCountryFlagEmoji } from '../lib/country-flag'

interface CountryFlagProps {
  countryCode?: string | null
  className?: string
  title?: string
}

const isAlpha2Code = (value: string) => /^[A-Z]{2}$/.test(value)

const toFlagImageUrl = (countryCode: string) => {
  return `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`
}

export default function CountryFlag({ countryCode, className, title }: CountryFlagProps) {
  const normalized = (countryCode || '').trim().toUpperCase()
  const [imageFailed, setImageFailed] = useState(false)
  const flagEmoji = getCountryFlagEmoji(normalized)

  if (!isAlpha2Code(normalized)) {
    return <span className={className} title={title || 'N/A'}>{flagEmoji}</span>
  }

  if (imageFailed) {
    return <span className={className} title={title || normalized}>{flagEmoji}</span>
  }

  return (
    <Image
      src={toFlagImageUrl(normalized)}
      alt={`${normalized} flag`}
      title={title || normalized}
      className={className}
      width={20}
      height={15}
      loading="lazy"
      unoptimized
      onError={() => setImageFailed(true)}
    />
  )
}
