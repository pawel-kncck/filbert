'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { KsefCredentials } from '@/lib/types/database'

type Props = {
  companyId: string
  credentials: KsefCredentials | null
}

export function KsefCredentialsSection({ companyId, credentials }: Props) {
  const t = useTranslations('companySettings.ksef')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('companySettings.errors')
  const router = useRouter()

  const [token, setToken] = useState('')
  const [environment, setEnvironment] = useState<'test' | 'demo' | 'prod'>('test')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (credentials) {
      setToken(credentials.token)
      setEnvironment(credentials.environment)
    }
  }, [credentials])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/companies/${companyId}/ksef-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), environment }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || tErrors('generic'))
        return
      }

      setSuccess(t('saved'))
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError(tErrors('connection'))
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm(t('removeConfirm'))) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/companies/${companyId}/ksef-credentials`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || tErrors('generic'))
        return
      }

      setToken('')
      setEnvironment('test')
      setSuccess(t('removed'))
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
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

      {success && (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="ksef-token"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('token')}
          </label>
          <div className="relative mt-1">
            <input
              id="ksef-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('tokenPlaceholder')}
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              {showToken ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="ksef-environment"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t('environment')}
          </label>
          <select
            id="ksef-environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'test' | 'demo' | 'prod')}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          >
            <option value="test">{t('environments.test')}</option>
            <option value="demo">{t('environments.demo')}</option>
            <option value="prod">{t('environments.prod')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? tCommon('loading') : t('save')}
          </button>

          {credentials && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {t('remove')}
            </button>
          )}
        </div>
      </form>

      {!credentials && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{t('noCredentials')}</p>
      )}
    </div>
  )
}
