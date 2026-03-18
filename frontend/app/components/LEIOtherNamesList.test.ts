import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import LEIOtherNamesList from './LEIOtherNamesList'

describe('LEIOtherNamesList', () => {
  const languagesByCode = new Map([
    ['en', { code: 'en', name: 'English' }],
    ['fr', { code: 'fr', name: 'French' }],
  ])

  it('renders nothing for empty or null-like other_names payloads', () => {
    const emptyArrayHtml = renderToStaticMarkup(
      React.createElement(LEIOtherNamesList, {
        otherNamesData: '[]',
        showCodes: false,
        languagesByCode,
      })
    )

    const nullLikeHtml = renderToStaticMarkup(
      React.createElement(LEIOtherNamesList, {
        otherNamesData: 'Array(0)',
        showCodes: false,
        languagesByCode,
      })
    )

    expect(emptyArrayHtml).toBe('')
    expect(nullLikeHtml).toBe('')
  })

  it('renders type and language code when showCodes is enabled', () => {
    const html = renderToStaticMarkup(
      React.createElement(LEIOtherNamesList, {
        otherNamesData: [{ name: 'ACME LTD', type: 'LOCAL_NAME', language: 'EN' }],
        showCodes: true,
        languagesByCode,
      })
    )

    expect(html).toContain('ACME LTD')
    expect(html).toContain('(LOCAL NAME)')
    expect(html).toContain('[en]')
  })

  it('renders language name when showCodes is disabled', () => {
    const html = renderToStaticMarkup(
      React.createElement(LEIOtherNamesList, {
        otherNamesData: JSON.stringify([{ name: 'Societe Exemple', type: 'ALTERNATIVE_LANGUAGE_LEGAL_NAME', language: 'fr' }]),
        showCodes: false,
        languagesByCode,
      })
    )

    expect(html).toContain('Societe Exemple')
    expect(html).toContain('(ALTERNATIVE LANGUAGE LEGAL NAME)')
    expect(html).toContain('[French]')
  })

  it('uses custom label and hides label when configured', () => {
    const withLabelHtml = renderToStaticMarkup(
      React.createElement(LEIOtherNamesList, {
        otherNamesData: [{ name: 'Example Name', type: 'TRADING_OR_OPERATING_NAME' }],
        showCodes: false,
        languagesByCode,
        label: 'Other Names',
      })
    )

    const withoutLabelHtml = renderToStaticMarkup(
      React.createElement(LEIOtherNamesList, {
        otherNamesData: [{ name: 'Example Name', type: 'TRADING_OR_OPERATING_NAME' }],
        showCodes: false,
        languagesByCode,
        showLabel: false,
      })
    )

    expect(withLabelHtml).toContain('Other Names')
    expect(withoutLabelHtml).not.toContain('Other names:')
  })
})
