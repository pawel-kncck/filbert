'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Props = {
  companyId: string
  hasCredentials: boolean
  hasDefaultCredential: boolean
}

export function KsefFetchSection({ companyId, hasCredentials, hasDefaultCredential }: Props) {
  const t = useTranslations('ksef.fetch')
  const tErrors = useTranslations('ksef.errors')
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [type, setType] = useState<'sales' | 'purchase'>('purchase')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  if (!hasCredentials) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('title')}</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t('noCredentials')}</p>
      </div>
    )
  }

  if (!hasDefaultCredential) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('title')}</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t('noDefaultCredential')}</p>
      </div>
    )
  }

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/companies/${companyId}/ksef/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, dateFrom, dateTo }),
      })

      if (!res.ok) {
        const data = await res.json()
        const code = data.error?.code
        if (code === 'AUTH_FAILED') {
          setError(tErrors('authFailed'))
        } else if (code === 'SESSION_FAILED') {
          setError(tErrors('sessionFailed'))
        } else if (code === 'CONNECTION_ERROR') {
          setError(tErrors('connection'))
        } else {
          setError(data.error?.message || tErrors('fetchFailed'))
        }
        return
      }

      const data = await res.json()
      setResult({ imported: data.imported, skipped: data.skipped })

      if (data.imported > 0) {
        router.refresh()
      }
    } catch {
      setError(tErrors('connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('title')}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('description')}</p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {result.imported > 0 || result.skipped > 0
            ? t('result', { imported: result.imported, skipped: result.skipped })
            : t('noResults')}
        </div>
      )}

      <form onSubmit={handleFetch} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="ksef-date-from"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('dateFrom')}
            </label>
            <input
              id="ksef-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="ksef-date-to"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('dateTo')}
            </label>
            <input
              id="ksef-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="ksef-type"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('type')}
          </label>
          <select
            id="ksef-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'sales' | 'purchase')}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          >
            <option value="purchase">{t('typePurchases')}</option>
            <option value="sales">{t('typeSales')}</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t('fetching') : t('button')}
        </button>
      </form>
    </div>
  )
}
