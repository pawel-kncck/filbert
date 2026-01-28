import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function InvoiceNotFound() {
  const t = await getTranslations('errors.invoiceNotFound')
  const tDetail = await getTranslations('invoices.detail')

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <p className="text-6xl font-bold text-zinc-300 dark:text-zinc-700">404</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t('description')}
        </p>
        <Link
          href="/sales"
          className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {tDetail('backToList')}
        </Link>
      </div>
    </div>
  )
}
