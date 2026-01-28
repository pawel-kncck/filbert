'use client'

import { useTranslations, useLocale } from 'next-intl'
import type { Invoice, InvoiceItem } from '@/lib/types/database'
import { KsefQrCode } from './ksef-qr-code'
import { generateKsefQrUrl } from '@/lib/ksef/generate-qr-data'

type Props = {
  invoice: Invoice
  items: InvoiceItem[]
}

export function KsefInvoiceView({ invoice, items }: Props) {
  const t = useTranslations('invoices.preview')
  const locale = useLocale()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      style: 'currency',
      currency: invoice.currency,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatNumber = (value: number, decimals: number) => {
    return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  const qrUrl = generateKsefQrUrl(invoice)

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm text-zinc-900">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">FAKTURA VAT</h1>
        <p className="mt-1 text-lg">{invoice.invoice_number}</p>
      </div>

      {/* Dates */}
      <div className="mb-6 text-sm">
        <span className="text-zinc-500">{t('issueDate')}:</span>{' '}
        <span className="font-medium">{formatDate(invoice.issue_date)}</span>
      </div>

      {/* Seller / Buyer */}
      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {t('seller')}
          </h2>
          <p className="font-medium">{invoice.vendor_name}</p>
          {invoice.vendor_nip && <p className="text-zinc-600">NIP: {invoice.vendor_nip}</p>}
        </div>
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {t('buyer')}
          </h2>
          <p className="font-medium">{invoice.customer_name}</p>
          {invoice.customer_nip && <p className="text-zinc-600">NIP: {invoice.customer_nip}</p>}
        </div>
      </div>

      {/* Items Table */}
      {items.length > 0 && (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-300 text-left">
                <th className="pb-2 pr-3 font-medium">{t('position')}</th>
                <th className="pb-2 pr-3 font-medium">{t('description')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('quantity')}</th>
                <th className="pb-2 pr-3 font-medium">{t('unit')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('unitPrice')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('vatRate')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('net')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('vat')}</th>
                <th className="pb-2 text-right font-medium">{t('gross')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-200">
                  <td className="py-2 pr-3 text-zinc-600">{item.position}</td>
                  <td className="py-2 pr-3">{item.description}</td>
                  <td className="py-2 pr-3 text-right">{formatNumber(Number(item.quantity), 3)}</td>
                  <td className="py-2 pr-3 text-zinc-600">{item.unit}</td>
                  <td className="py-2 pr-3 text-right">
                    {formatCurrency(Number(item.unit_price))}
                  </td>
                  <td className="py-2 pr-3 text-right text-zinc-600">
                    {formatNumber(Number(item.vat_rate), 0)}%
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatCurrency(Number(item.net_amount))}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatCurrency(Number(item.vat_amount))}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(Number(item.gross_amount))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-300 font-medium">
                <td colSpan={6} className="pt-2 pr-3 text-right text-zinc-500">
                  {t('total')}
                </td>
                <td className="pt-2 pr-3 text-right">
                  {formatCurrency(items.reduce((s, i) => s + Number(i.net_amount), 0))}
                </td>
                <td className="pt-2 pr-3 text-right">
                  {formatCurrency(items.reduce((s, i) => s + Number(i.vat_amount), 0))}
                </td>
                <td className="pt-2 text-right font-bold">
                  {formatCurrency(items.reduce((s, i) => s + Number(i.gross_amount), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="mb-8 flex justify-end">
        <div className="w-64 space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">{t('totalNet')}:</span>
            <span>{formatCurrency(invoice.net_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">{t('totalVat')}:</span>
            <span>{formatCurrency(invoice.vat_amount)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-300 pt-1 font-bold">
            <span>{t('totalGross')}:</span>
            <span>{formatCurrency(invoice.gross_amount)}</span>
          </div>
        </div>
      </div>

      {/* QR Code */}
      {qrUrl && invoice.ksef_reference && (
        <div className="border-t border-zinc-200 pt-6">
          <KsefQrCode url={qrUrl} ksefReference={invoice.ksef_reference} />
        </div>
      )}
    </div>
  )
}
