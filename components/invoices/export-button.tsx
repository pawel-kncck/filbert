'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Invoice } from '@/lib/types/database'

type Props = {
  invoices: Invoice[]
  type: 'sales' | 'purchase'
  companyName: string
}

export function ExportButton({ invoices, type, companyName }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const t = useTranslations('invoices.export')
  const locale = useLocale()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-US')
  }

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2).replace('.', locale === 'pl' ? ',' : '.')
  }

  const exportToCsv = () => {
    setIsExporting(true)

    try {
      const headers = [
        t('columns.invoiceNumber'),
        t('columns.issueDate'),
        type === 'sales' ? t('columns.buyer') : t('columns.seller'),
        'NIP',
        t('columns.net'),
        t('columns.vat'),
        t('columns.gross'),
        t('columns.currency'),
        t('columns.ksef'),
      ]

      const rows = invoices.map((inv) => [
        inv.invoice_number,
        formatDate(inv.issue_date),
        type === 'sales' ? inv.customer_name : inv.vendor_name,
        type === 'sales' ? inv.customer_nip || '' : inv.vendor_nip || '',
        formatCurrency(inv.net_amount),
        formatCurrency(inv.vat_amount),
        formatCurrency(inv.gross_amount),
        inv.currency,
        inv.ksef_reference || '',
      ])

      // Add BOM for Excel to recognize UTF-8
      const BOM = '\uFEFF'
      const csvContent =
        BOM +
        [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const dateStr = new Date().toISOString().split('T')[0]
      const typeStr = type === 'sales' ? 'sales' : 'purchases'
      link.download = `invoices_${typeStr}_${companyName.replace(/\s+/g, '_')}_${dateStr}.csv`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  if (invoices.length === 0) return null

  return (
    <button
      onClick={exportToCsv}
      disabled={isExporting}
      className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {isExporting ? t('exporting') : t('exportCsv')}
    </button>
  )
}
