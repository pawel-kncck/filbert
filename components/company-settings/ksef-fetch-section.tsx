'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Input, SelectInput } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'

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

      {error && <Alert className="mt-4">{error}</Alert>}

      {result && (
        <Alert variant="success" className="mt-4">
          {result.imported > 0 || result.skipped > 0
            ? t('result', { imported: result.imported, skipped: result.skipped })
            : t('noResults')}
        </Alert>
      )}

      <form onSubmit={handleFetch} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('dateFrom')} htmlFor="ksef-date-from">
            <Input
              id="ksef-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1"
            />
          </FormField>
          <FormField label={t('dateTo')} htmlFor="ksef-date-to">
            <Input
              id="ksef-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1"
            />
          </FormField>
        </div>

        <FormField label={t('type')} htmlFor="ksef-type">
          <SelectInput
            id="ksef-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'sales' | 'purchase')}
            className="mt-1"
          >
            <option value="purchase">{t('typePurchases')}</option>
            <option value="sales">{t('typeSales')}</option>
          </SelectInput>
        </FormField>

        <Button type="submit" disabled={loading}>
          {loading ? t('fetching') : t('button')}
        </Button>
      </form>
    </div>
  )
}
