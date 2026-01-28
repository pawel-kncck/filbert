'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Props = {
  missingCount: number
  companyId: string
}

export function MissingCustomersAlert({ missingCount, companyId }: Props) {
  const router = useRouter()
  const t = useTranslations('customers')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (missingCount === 0) return null

  const handleSync = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/customers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || t('errors.generic'))
        return
      }

      router.refresh()
    } catch {
      setError(t('errors.connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {t('missingAlert.message', { count: missingCount })}
        </p>
        <button
          onClick={handleSync}
          disabled={loading}
          className="shrink-0 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? '...' : t('missingAlert.import')}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
