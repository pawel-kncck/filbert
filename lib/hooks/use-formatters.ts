'use client'

import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import type { Locale } from '@/lib/i18n/config'
import {
  formatCurrency,
  formatDate,
  formatDateLong,
  formatNumber,
  formatPercent,
} from '@/lib/i18n/formatters'

/**
 * Locale-bound versions of the shared formatters from `lib/i18n/formatters.ts`
 * for use in client components.
 */
export function useFormatters() {
  const locale = useLocale() as Locale

  return useMemo(
    () => ({
      locale,
      formatCurrency: (amount: number, currency?: string) =>
        formatCurrency(amount, locale, currency),
      formatDate: (dateString: string, options?: Intl.DateTimeFormatOptions) =>
        formatDate(dateString, locale, options),
      formatDateLong: (dateString: string) => formatDateLong(dateString, locale),
      formatNumber: (amount: number, decimals?: number) => formatNumber(amount, locale, decimals),
      formatPercent: (value: number) => formatPercent(value, locale),
    }),
    [locale]
  )
}
