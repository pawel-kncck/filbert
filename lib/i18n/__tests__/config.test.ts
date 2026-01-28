import { describe, it, expect } from 'vitest'
import { locales, defaultLocale, localeNames, localeCookieName } from '../config'

describe('i18n config', () => {
  it('has pl and en locales', () => {
    expect(locales).toContain('pl')
    expect(locales).toContain('en')
    expect(locales).toHaveLength(2)
  })

  it('defaults to Polish locale', () => {
    expect(defaultLocale).toBe('pl')
  })

  it('has locale names for all locales', () => {
    expect(localeNames.pl).toBe('Polski')
    expect(localeNames.en).toBe('English')
  })

  it('has a cookie name defined', () => {
    expect(localeCookieName).toBe('NEXT_LOCALE')
  })
})
