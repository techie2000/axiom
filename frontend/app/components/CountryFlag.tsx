'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { getCountryFlagEmoji } from '../lib/country-flag'

interface CountryFlagProps {
  countryCode?: string | null
  className?: string
  title?: string
}

const isAlpha2Code = (value: string) => /^[A-Z]{2}$/.test(value)

const toFlagImageUrl = (countryCode: string, width: number = 20) => {
  return `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`
}

type FlagSizing = {
  className?: string
  style?: CSSProperties
}

const widthClassPattern = /^(?:[a-z0-9-]+:)*!?w-(?!auto\b)\S+$/i
const heightClassPattern = /^(?:[a-z0-9-]+:)*!?h-(?!auto\b)\S+$/i

function resolveFlagSizing(className?: string): FlagSizing {
  if (!className) {
    return {}
  }

  const tokens = className.split(/\s+/).filter(Boolean)
  const hasWidthConstraint = tokens.some((token) => widthClassPattern.test(token))
  const hasHeightConstraint = tokens.some((token) => heightClassPattern.test(token))

  let normalizedClassName = className
  if (hasHeightConstraint && hasWidthConstraint) {
    return {
      className: normalizedClassName,
      style: { objectFit: 'cover' },
    }
  }

  if (hasHeightConstraint) {
    return {
      className: normalizedClassName,
      style: { width: 'auto' },
    }
  }

  if (hasWidthConstraint) {
    return {
      className: normalizedClassName,
      style: { height: 'auto' },
    }
  }

  return { className: normalizedClassName }
}

export default function CountryFlag({ countryCode, className, title }: CountryFlagProps) {
  const normalized = (countryCode || '').trim().toUpperCase()
  const [imageFailed, setImageFailed] = useState(false)
  const flagEmoji = getCountryFlagEmoji(normalized)
  const { className: normalizedClassName, style } = resolveFlagSizing(className)

  if (!isAlpha2Code(normalized)) {
    return <span className={normalizedClassName} title={title || 'N/A'}>{flagEmoji}</span>
  }

  if (imageFailed) {
    return <span className={normalizedClassName} title={title || normalized}>{flagEmoji}</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={toFlagImageUrl(normalized, 20)}
      srcSet={`${toFlagImageUrl(normalized, 20)} 1x, ${toFlagImageUrl(normalized, 40)} 2x, ${toFlagImageUrl(normalized, 80)} 4x`}
      alt={`${normalized} flag`}
      title={title || normalized}
      className={normalizedClassName}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  )
}
