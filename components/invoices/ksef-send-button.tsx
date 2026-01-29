'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Invoice } from '@/lib/types/database'

type Props = {
  invoice: Invoice
  hasCredentials: boolean
}

export function KsefSendButton({ invoice, hasCredentials }: Props) {
  const t = useTranslations('ksef.send')
  const tErrors = useTranslations('ksef.errors')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Don't show if not sales, already has reference, or already pending
  if (invoice.type !== 'sales' || invoice.ksef_reference || invoice.ksef_status === 'pending') {
    return null
  }

  if (!hasCredentials) {
    return <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('noCredentials')}</span>
  }

  const handleSend = async () => {
    if (!confirm(t('confirmMessage'))) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/ksef/send`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        const code = data.error?.code
        if (code === 'AUTH_FAILED') {
          setError(tErrors('authFailed'))
        } else if (code === 'SESSION_FAILED') {
          setError(tErrors('sessionFailed'))
        } else if (code === 'SEND_FAILED') {
          setError(tErrors('sendFailed'))
        } else if (code === 'CONNECTION_ERROR') {
          setError(tErrors('connection'))
        } else {
          setError(data.error?.message || tErrors('generic'))
        }
        return
      }

      router.refresh()
    } catch {
      setError(tErrors('connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
        {loading ? t('sending') : t('button')}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}
