'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type Props = {
  companyId: string
  companyName: string
}

export function DeleteCompanySection({ companyId, companyName }: Props) {
  const t = useTranslations('companySettings.delete')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('companySettings.errors')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (confirmName !== companyName) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || tErrors('generic'))
        return
      }

      router.push('/companies')
      router.refresh()
    } catch {
      setError(tErrors('connection'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      setConfirmName('')
      setError(null)
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-zinc-800">
      <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">{t('title')}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('description')}</p>

      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        {t('button')}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-white dark:bg-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-red-700 dark:text-red-400">
              {t('confirmTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('confirmMessage')}</p>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="confirm-company-name"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t('confirmLabel', { name: companyName })}
              </label>
              <input
                id="confirm-company-name"
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || confirmName !== companyName}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? t('deleting') : t('confirmButton')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
