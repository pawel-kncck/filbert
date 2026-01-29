'use client'

import { useTranslations } from 'next-intl'

type KsefStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'error'

type Props = {
  status: KsefStatus
  ksefReference?: string | null
  error?: string | null
}

export function KsefStatusBadge({ status, ksefReference, error }: Props) {
  const t = useTranslations('ksef.status')

  const config: Record<KsefStatus, { bg: string; text: string; animate?: boolean }> = {
    pending: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/50',
      text: 'text-yellow-800 dark:text-yellow-300',
      animate: true,
    },
    sent: {
      bg: 'bg-blue-100 dark:bg-blue-900/50',
      text: 'text-blue-800 dark:text-blue-300',
    },
    accepted: {
      bg: 'bg-green-100 dark:bg-green-900/50',
      text: 'text-green-800 dark:text-green-300',
    },
    rejected: {
      bg: 'bg-red-100 dark:bg-red-900/50',
      text: 'text-red-800 dark:text-red-300',
    },
    error: {
      bg: 'bg-red-100 dark:bg-red-900/50',
      text: 'text-red-800 dark:text-red-300',
    },
  }

  const { bg, text, animate } = config[status]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
      title={error || undefined}
    >
      {animate && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {status === 'accepted' && ksefReference ? ksefReference.slice(0, 10) + '...' : t(status)}
    </span>
  )
}
