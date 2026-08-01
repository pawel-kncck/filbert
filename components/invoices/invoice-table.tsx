'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Invoice } from '@/lib/types/database'
import { useFormatters } from '@/lib/hooks/use-formatters'
import { KsefPreviewModal } from './ksef-preview-modal'
import { KsefStatusBadge } from './ksef-status-badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
} from '@/components/ui/empty-state'

type Props = {
  invoices: Invoice[]
  type: 'sales' | 'purchase'
}

export function InvoiceTable({ invoices, type }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const { formatCurrency, formatDate } = useFormatters()
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  if (invoices.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <EmptyStateTitle>{t('invoices.table.empty')}</EmptyStateTitle>
        <EmptyStateDescription>
          {type === 'sales'
            ? t('invoices.sales.emptyMessage')
            : t('invoices.purchases.emptyMessage')}
        </EmptyStateDescription>
      </EmptyState>
    )
  }

  const handleRowClick = (invoiceId: string) => {
    router.push(`/${type === 'sales' ? 'sales' : 'purchases'}/${invoiceId}`)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('invoices.table.invoiceNumber')}</TableHead>
            <TableHead>{t('invoices.table.date')}</TableHead>
            <TableHead>
              {type === 'sales' ? t('invoices.table.buyer') : t('invoices.table.seller')}
            </TableHead>
            <TableHead>NIP</TableHead>
            <TableHead className="text-right">{t('invoices.table.net')}</TableHead>
            <TableHead className="text-right">{t('invoices.table.vat')}</TableHead>
            <TableHead className="text-right">{t('invoices.table.gross')}</TableHead>
            <TableHead>{t('invoices.table.ksef')}</TableHead>
            {(type === 'sales' ||
              invoices.some((inv) => inv.source === 'ksef' && inv.ksef_reference)) && (
              <TableHead className="sticky right-0 bg-zinc-50 text-right dark:bg-zinc-700/50">
                {t('common.actions')}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow
              key={invoice.id}
              onClick={() => handleRowClick(invoice.id)}
              className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            >
              <TableCell className="max-w-[120px] truncate whitespace-nowrap font-medium text-zinc-900 dark:text-white">
                {invoice.invoice_number}
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                {formatDate(invoice.issue_date)}
              </TableCell>
              <TableCell
                className="max-w-[150px] truncate text-zinc-900 dark:text-white"
                title={type === 'sales' ? invoice.customer_name : invoice.vendor_name}
              >
                {type === 'sales' ? invoice.customer_name : invoice.vendor_name}
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                {type === 'sales' ? invoice.customer_nip || '-' : invoice.vendor_nip || '-'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-zinc-900 dark:text-white">
                {formatCurrency(invoice.net_amount, invoice.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-zinc-600 dark:text-zinc-400">
                {formatCurrency(invoice.vat_amount, invoice.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium text-zinc-900 dark:text-white">
                {formatCurrency(invoice.gross_amount, invoice.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
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
              </TableCell>
              {(type === 'sales' || (invoice.source === 'ksef' && invoice.ksef_reference)) && (
                <TableCell className="sticky right-0 whitespace-nowrap bg-white text-right dark:bg-zinc-800">
                  <div className="flex items-center justify-end gap-1">
                    {invoice.source === 'ksef' && invoice.ksef_reference && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewInvoice(invoice)
                          }}
                          className="dark:hover:bg-zinc-600 dark:hover:text-white"
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
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`/api/invoices/${invoice.id}/xml`, '_blank')
                          }}
                          className="dark:hover:bg-zinc-600 dark:hover:text-white"
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
                        </Button>
                      </>
                    )}
                    {type === 'sales' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/sales/new?copy=${invoice.id}`)
                        }}
                        className="dark:hover:bg-zinc-600 dark:hover:text-white"
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
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {previewInvoice && (
        <KsefPreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}
    </>
  )
}
