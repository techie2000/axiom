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
    expect(html).toContain('srcSet="https://flagcdn.com/w20/gb.png 1x, https://flagcdn.com/w40/gb.png 2x, https://flagcdn.com/w80/gb.png 4x"')
    expect(html).toContain('alt="GB flag"')
    expect(html).toContain('class="h-4 w-6"')
    expect(html).toContain('object-fit:cover')
  })

  it('preserves aspect ratio when only width is constrained', () => {
    const html = renderToStaticMarkup(
      React.createElement(CountryFlag, {
        countryCode: 'SE',
        className: 'w-6 rounded-sm',
      })
    )

    expect(html).toContain('height:auto')
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
