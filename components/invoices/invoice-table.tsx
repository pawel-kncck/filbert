'use client'

import { useRouter } from 'next/navigation'
import { Invoice } from '@/lib/types/database'

type Props = {
  invoices: Invoice[]
  type: 'sales' | 'purchase'
}

function formatCurrency(amount: number, currency: string = 'PLN'): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function InvoiceTable({ invoices, type }: Props) {
  const router = useRouter()

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
          Brak faktur
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {type === 'sales'
            ? 'Nie znaleziono faktur sprzedażowych dla wybranych kryteriów.'
            : 'Nie znaleziono faktur zakupowych dla wybranych kryteriów.'}
        </p>
      </div>
    )
  }

  const handleRowClick = (invoiceId: string) => {
    router.push(`/${type === 'sales' ? 'sales' : 'purchases'}/${invoiceId}`)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-700/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Numer faktury
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {type === 'sales' ? 'Nabywca' : 'Sprzedawca'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              NIP
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Netto
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              VAT
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Brutto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              KSeF
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              onClick={() => handleRowClick(invoice.id)}
              className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white">
                {invoice.invoice_number}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {formatDate(invoice.issue_date)}
              </td>
              <td className="max-w-[200px] truncate px-4 py-3 text-sm text-zinc-900 dark:text-white">
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
                {invoice.ksef_reference ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    {invoice.ksef_reference.slice(0, 10)}...
                  </span>
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
