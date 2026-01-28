import { describe, it, expect } from 'vitest'
import {
  getLocaleCode,
  formatCurrency,
  formatDate,
  formatDateLong,
  formatNumber,
  formatPercent,
} from '../formatters'

describe('getLocaleCode', () => {
  it('returns pl-PL for Polish locale', () => {
    expect(getLocaleCode('pl')).toBe('pl-PL')
  })

  it('returns en-US for English locale', () => {
    expect(getLocaleCode('en')).toBe('en-US')
  })
})

describe('formatCurrency', () => {
  it('formats PLN amount in Polish locale', () => {
    const result = formatCurrency(1234.56, 'pl')
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
    expect(result).toMatch(/PLN|zł/)
  })

  it('formats PLN amount in English locale', () => {
    const result = formatCurrency(1234.56, 'en')
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
  })

  it('formats with custom currency', () => {
    const result = formatCurrency(100, 'en', 'USD')
    expect(result).toContain('100')
    expect(result).toMatch(/\$|USD/)
  })

  it('defaults to PLN when no currency specified', () => {
    const result = formatCurrency(100, 'pl')
    expect(result).toMatch(/PLN|zł/)
  })
})

describe('formatDate', () => {
  it('formats date in Polish locale with default options', () => {
    const result = formatDate('2024-01-15', 'pl')
    expect(result).toContain('15')
    expect(result).toContain('01')
    expect(result).toContain('2024')
  })

  it('formats date in English locale with default options', () => {
    const result = formatDate('2024-01-15', 'en')
    expect(result).toContain('15')
    expect(result).toContain('01')
    expect(result).toContain('2024')
  })
})

describe('formatDateLong', () => {
  it('formats date with long month name in Polish', () => {
    const result = formatDateLong('2024-01-15', 'pl')
    expect(result).toContain('15')
    expect(result).toContain('2024')
    // Polish month name for January
    expect(result).toMatch(/stycz/i)
  })

  it('formats date with long month name in English', () => {
    const result = formatDateLong('2024-01-15', 'en')
    expect(result).toContain('15')
    expect(result).toContain('2024')
    expect(result).toMatch(/january/i)
  })
})

describe('formatNumber', () => {
  it('formats number with locale-specific separators', () => {
    const resultPl = formatNumber(1234567.89, 'pl')
    expect(resultPl).toContain('1')
    expect(resultPl).toContain('234')
    expect(resultPl).toContain('567')

    const resultEn = formatNumber(1234567.89, 'en')
    expect(resultEn).toContain('1')
    expect(resultEn).toContain('234')
    expect(resultEn).toContain('567')
  })
})

describe('formatPercent', () => {
  it('formats percentage value', () => {
    const result = formatPercent(0.23, 'pl')
    expect(result).toContain('23')
    expect(result).toContain('%')
  })

  it('handles zero value', () => {
    const result = formatPercent(0, 'en')
    expect(result).toContain('0')
    expect(result).toContain('%')
  })
})
