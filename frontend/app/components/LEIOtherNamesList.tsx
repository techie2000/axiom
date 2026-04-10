'use client'

import React from 'react'

interface LanguageOption {
  code: string
  name: string
}

interface LEIOtherName {
  name: string
  type: string
  language?: string
}

interface LEIOtherNamesListProps {
  otherNamesData: unknown
  showCodes: boolean
  languagesByCode: Map<string, LanguageOption>
  showLabel?: boolean
  label?: string
  labelClassName?: string
  className?: string
  listClassName?: string
  itemClassName?: string
  languageClassName?: string
}

function parseOtherNames(otherNamesData: unknown): LEIOtherName[] {
  if (!otherNamesData) return []

  if (Array.isArray(otherNamesData)) {
    return otherNamesData as LEIOtherName[]
  }

  if (typeof otherNamesData === 'string') {
    if (otherNamesData === '[]' || otherNamesData === 'null' || otherNamesData === '' || otherNamesData.startsWith('Array(')) {
      return []
    }

    try {
      const parsed = JSON.parse(otherNamesData)
      return Array.isArray(parsed) ? (parsed as LEIOtherName[]) : []
    } catch {
      return []
    }
  }

  return []
}

function formatLanguageDisplay(languageCode: string, showCodes: boolean, languagesByCode: Map<string, LanguageOption>): string {
  const normalizedCode = (languageCode || '').trim().toLowerCase()
  if (!normalizedCode) {
    return '-'
  }

  if (showCodes) {
    return normalizedCode
  }

  return languagesByCode.get(normalizedCode)?.name || normalizedCode
}

export default function LEIOtherNamesList({
  otherNamesData,
  showCodes,
  languagesByCode,
  showLabel = true,
  label = 'Other names:',
  labelClassName = '',
  className = 'mt-1 text-xs theme-text-muted',
  listClassName = '',
  itemClassName = 'ml-2',
  languageClassName = 'ml-1 theme-text-muted',
}: LEIOtherNamesListProps) {
  const otherNames = parseOtherNames(otherNamesData)
  if (otherNames.length === 0) {
    return null
  }

  return (
    <div className={className}>
      {showLabel && <div className={labelClassName}>{label}</div>}
      <div className={listClassName}>
        {otherNames.map((otherName, index) => (
          <div key={`${otherName.name}-${otherName.type}-${index}`} className={itemClassName}>
            {otherName.name}
            {otherName.type && (
              <span className={languageClassName}>
                ({otherName.type.replace(/_/g, ' ')})
              </span>
            )}
            {otherName.language && (
              <span className={languageClassName}>
                [{formatLanguageDisplay(otherName.language, showCodes, languagesByCode)}]
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
