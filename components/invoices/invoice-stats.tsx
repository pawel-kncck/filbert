'use client'

import { useTranslations, useLocale } from 'next-intl'

type Props = {
  totalCount: number
  totalNet: number
  totalVat: number
  totalGross: number
  currency?: string
}

export function InvoiceStats({ totalCount, totalNet, totalVat, totalGross, currency = 'PLN' }: Props) {
  const t = useTranslations('invoices.stats')
  const locale = useLocale()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const stats = [
    { label: t('count'), value: totalCount.toString() },
    { label: t('sumNet'), value: formatCurrency(totalNet) },
    { label: t('sumVat'), value: formatCurrency(totalVat) },
    { label: t('sumGross'), value: formatCurrency(totalGross) },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
