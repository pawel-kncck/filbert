'use client'

import { useTranslations } from 'next-intl'

import { Alert } from '@/components/ui/alert'

/** Banner at the top of the form: first failure, plus a count when there are more. */
export function InvoiceErrorSummary({
  message,
  errorCount,
}: {
  message: string
  errorCount: number
}) {
  const t = useTranslations('invoices.form')

  return (
    <Alert size="md" className="bg-red-50 text-inherit dark:bg-red-900/30">
      <div className="flex">
        <svg
          className="h-5 w-5 shrink-0 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <div className="ml-3">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{message}</p>
          {errorCount > 1 && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {t('errors.generic').replace('.', '')}: {errorCount}{' '}
              {errorCount === 1 ? 'error' : 'errors'}
            </p>
          )}
        </div>
      </div>
    </Alert>
  )
}
