import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import CountryFlag from './CountryFlag'

describe('CountryFlag', () => {
  it('renders an image for valid alpha-2 country code', () => {
    const html = renderToStaticMarkup(
      React.createElement(CountryFlag, {
        countryCode: 'GB',
        className: 'h-4 w-6',
        title: 'United Kingdom',
      })
    )

    expect(html).toContain('<img')
    expect(html).toContain('src="https://flagcdn.com/w20/gb.png"')
    expect(html).toContain('alt="GB flag"')
  })

  it('renders fallback span for invalid country code', () => {
    const html = renderToStaticMarkup(
      React.createElement(CountryFlag, {
        countryCode: 'GBR',
        className: 'h-4 w-6',
        title: 'Invalid',
      })
    )

    expect(html).toContain('<span')
    expect(html).toContain('—')
  })
})
