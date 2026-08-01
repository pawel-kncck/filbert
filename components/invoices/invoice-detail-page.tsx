import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceById } from '@/lib/data/invoices'
import { requirePageCompanyContext } from '@/lib/data/page-context'
import { getInvoiceItems } from '@/lib/data/invoice-items'
import { getKsefCredentialsForCompany } from '@/lib/data/ksef'
import { AppShell } from '@/components/layout/app-shell'
import { InvoiceItemsTable } from '@/components/invoices/invoice-items-table'
import { KsefPreviewButton } from '@/components/invoices/ksef-preview-button'
import { KsefSendButton } from '@/components/invoices/ksef-send-button'
import { KsefStatusBadge } from '@/components/invoices/ksef-status-badge'
import { getTranslations } from 'next-intl/server'
import { formatCurrency, formatDateLong } from '@/lib/i18n/formatters'

type Props = {
  type: 'sales' | 'purchase'
  params: Promise<{ id: string }>
  searchParams: Promise<{ company?: string }>
}

export async function InvoiceDetailPage({ type, params, searchParams }: Props) {
  const { id } = await params
  const { company } = await searchParams
  const t = await getTranslations()
  const { user, locale, companies, currentCompanyId } = await requirePageCompanyContext(company)

  const invoice = await getInvoiceById(id, currentCompanyId)

  if (!invoice || invoice.type !== type) {
    notFound()
  }

  const items = await getInvoiceItems(invoice.id)
  const credentials = await getKsefCredentialsForCompany(currentCompanyId)
  const hasCredentials = !!credentials

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'manual':
        return t('invoices.detail.sources.manual')
      case 'demo':
        return t('invoices.detail.sources.demo')
      default:
        return t('invoices.detail.sources.ksef')
    }
  }

  const listPath = type === 'sales' ? '/sales' : '/purchases'
  const invoiceTypeLabel =
    type === 'sales' ? t('invoices.detail.salesInvoice') : t('invoices.detail.purchaseInvoice')

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
      currentLocale={locale}
    >
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Link
            href={`${listPath}?company=${currentCompanyId}`}
            className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t('invoices.detail.backToList')}
          </Link>
        </div>

        {/* Invoice header */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {invoice.invoice_number}
              </h1>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{invoiceTypeLabel}</p>
                <KsefPreviewButton invoice={invoice} items={items} />
                <KsefSendButton invoice={invoice} hasCredentials={hasCredentials} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('invoices.detail.issueDate')}
              </p>
              <p className="text-lg font-medium text-zinc-900 dark:text-white">
                {formatDateLong(invoice.issue_date, locale)}
              </p>
            </div>
          </div>

          {(invoice.ksef_reference || invoice.ksef_status) && (
            <div className="mt-4 flex items-center gap-2">
              {invoice.ksef_reference && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
                  KSeF: {invoice.ksef_reference}
                </span>
              )}
              {invoice.ksef_status && (
                <KsefStatusBadge
                  status={invoice.ksef_status}
                  ksefReference={invoice.ksef_reference}
                  error={invoice.ksef_error}
                />
              )}
            </div>
          )}

          {invoice.ksef_status === 'error' && invoice.ksef_error && (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {invoice.ksef_error}
            </div>
          )}
        </div>

        {/* Parties */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Seller */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.detail.seller')}
            </h2>
            <p className="mt-2 text-lg font-medium text-zinc-900 dark:text-white">
              {invoice.vendor_name}
            </p>
            {invoice.vendor_nip && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                NIP: {invoice.vendor_nip}
              </p>
            )}
          </div>

          {/* Buyer */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('invoices.detail.buyer')}
            </h2>
            <p className="mt-2 text-lg font-medium text-zinc-900 dark:text-white">
              {invoice.customer_name}
            </p>
            {invoice.customer_nip && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                NIP: {invoice.customer_nip}
              </p>
            )}
          </div>
        </div>

        {/* Invoice items */}
        <InvoiceItemsTable items={items} currency={invoice.currency} locale={locale} />

        {/* Amounts */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('invoices.detail.amounts')}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('invoices.detail.net')}</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                {formatCurrency(invoice.net_amount, locale, invoice.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">VAT</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                {formatCurrency(invoice.vat_amount, locale, invoice.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('invoices.detail.gross')}
              </p>
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                {formatCurrency(invoice.gross_amount, locale, invoice.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('invoices.detail.additionalInfo')}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('invoices.detail.currency')}
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                {invoice.currency}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('invoices.detail.source')}
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                {getSourceLabel(invoice.source)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('invoices.detail.added')}
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                {formatDateLong(invoice.created_at, locale)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </AppShell>
  )
}
