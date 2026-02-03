'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Invoice } from '@/lib/types/database'
import { KsefPreviewModal } from './ksef-preview-modal'
import { KsefStatusBadge } from './ksef-status-badge'

type Props = {
  invoices: Invoice[]
  type: 'sales' | 'purchase'
}

export function InvoiceTable({ invoices, type }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  const formatCurrency = (amount: number, currency: string = 'PLN') => {
    return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <svg
          className="mx-auto h-12 w-12 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-white">
          {t('invoices.table.empty')}
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {type === 'sales'
            ? t('invoices.sales.emptyMessage')
            : t('invoices.purchases.emptyMessage')}
        </p>
      </div>
    )
  }

  const handleRowClick = (invoiceId: string) => {
    router.push(`/${type === 'sales' ? 'sales' : 'purchases'}/${invoiceId}`)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-700/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.table.invoiceNumber')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.table.date')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {type === 'sales' ? t('invoices.table.buyer') : t('invoices.table.seller')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              NIP
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.table.net')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.table.vat')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.table.gross')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.table.ksef')}
            </th>
            {(type === 'sales' ||
              invoices.some((inv) => inv.source === 'ksef' && inv.ksef_reference)) && (
              <th className="sticky right-0 bg-zinc-50 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-400">
                {t('common.actions')}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              onClick={() => handleRowClick(invoice.id)}
              className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            >
              <td className="max-w-[120px] truncate whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white">
                {invoice.invoice_number}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {formatDate(invoice.issue_date)}
              </td>
              <td
                className="max-w-[150px] truncate px-4 py-3 text-sm text-zinc-900 dark:text-white"
                title={type === 'sales' ? invoice.customer_name : invoice.vendor_name}
              >
                {type === 'sales' ? invoice.customer_name : invoice.vendor_name}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {type === 'sales' ? invoice.customer_nip || '-' : invoice.vendor_nip || '-'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-zinc-900 dark:text-white">
                {formatCurrency(invoice.net_amount, invoice.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                {formatCurrency(invoice.vat_amount, invoice.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-zinc-900 dark:text-white">
                {formatCurrency(invoice.gross_amount, invoice.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                {invoice.ksef_status ? (
                  <KsefStatusBadge
                    status={invoice.ksef_status}
                    ksefReference={invoice.ksef_reference}
                    error={invoice.ksef_error}
                  />
                ) : invoice.ksef_reference ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    {invoice.ksef_reference.slice(0, 10)}...
                  </span>
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </td>
              {(type === 'sales' || (invoice.source === 'ksef' && invoice.ksef_reference)) && (
                <td className="sticky right-0 whitespace-nowrap bg-white px-4 py-3 text-right text-sm dark:bg-zinc-800">
                  <div className="flex items-center justify-end gap-1">
                    {invoice.source === 'ksef' && invoice.ksef_reference && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewInvoice(invoice)
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-white"
                          title={t('invoices.preview.preview')}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`/api/invoices/${invoice.id}/xml`, '_blank')
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-white"
                          title="View XML"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                    {type === 'sales' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/sales/new?copy=${invoice.id}`)
                        }}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-white"
                        title={t('invoices.form.copy')}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {previewInvoice && (
        <KsefPreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}
    </div>
  )
}
