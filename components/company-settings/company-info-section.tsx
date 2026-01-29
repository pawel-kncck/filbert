'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Props = {
  companyId: string
  companyName: string
  companyNip: string
  isAdmin: boolean
}

export function CompanyInfoSection({ companyId, companyName, companyNip, isAdmin }: Props) {
  const t = useTranslations('companySettings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(companyName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || t('errors.generic'))
        return
      }

      setEditing(false)
      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError(t('errors.connection'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setName(companyName)
    setEditing(false)
    setError(null)
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            {t('nameUpdated')}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('companyName')}
          </label>
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
              <button
                onClick={handleSave}
                disabled={loading || !name.trim()}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? tCommon('loading') : tCommon('save')}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {tCommon('cancel')}
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-zinc-900 dark:text-white">{companyName}</p>
              {isAdmin && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('nip')}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-zinc-900 dark:text-white">{companyNip}</p>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('nipReadOnly')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
