import type { Locale } from './config'

export function getLocaleCode(locale: Locale): string {
  return locale === 'pl' ? 'pl-PL' : 'en-US'
}

export function formatCurrency(
  amount: number,
  locale: Locale,
  currency: string = 'PLN'
): string {
  return new Intl.NumberFormat(getLocaleCode(locale), {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(
  dateString: string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  return new Date(dateString).toLocaleDateString(
    getLocaleCode(locale),
    options || defaultOptions
  )
}

export function formatDateLong(dateString: string, locale: Locale): string {
  return new Date(dateString).toLocaleDateString(getLocaleCode(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatNumber(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(getLocaleCode(locale)).format(amount)
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(getLocaleCode(locale), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}
