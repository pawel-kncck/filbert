'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ContactEntity } from '@/lib/types/contacts'
import { CONTACT_UI } from './config'
import { Button } from '@/components/ui/button'

type Props = {
  entity: ContactEntity
  missingCount: number
  companyId: string
}

export function MissingContactsAlert({ entity, missingCount, companyId }: Props) {
  const config = CONTACT_UI[entity]
  const router = useRouter()
  const t = useTranslations(config.namespace)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (missingCount === 0) return null

  const handleSync = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${config.apiBase}/sync`, {
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
        <Button variant="warning" onClick={handleSync} disabled={loading}>
          {loading ? '...' : t('missingAlert.import')}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
