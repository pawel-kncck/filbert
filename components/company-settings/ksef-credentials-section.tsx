'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusIcon } from 'lucide-react'

import type { KsefCredentials } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { KsefAddCredentialModal } from './ksef-add-credential-modal'
import { CredentialsTable } from './ksef-credentials/credentials-table'
import { useCredentialActions } from './ksef-credentials/use-credential-actions'

type Props = {
  companyId: string
  credentials: KsefCredentials[]
}

/**
 * Card listing a company's KSeF credentials. Row actions live in
 * `useCredentialActions`; the table itself is `CredentialsTable`.
 */
export function KsefCredentialsSection({ companyId, credentials }: Props) {
  const t = useTranslations('companySettings.ksef')
  const router = useRouter()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const actions = useCredentialActions(companyId)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('title')}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('description')}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          {t('addCredentials')}
        </Button>
      </div>

      {actions.error && <Alert className="mx-4 mt-4">{actions.error}</Alert>}

      {actions.success && (
        <Alert variant="success" className="mx-4 mt-4">
          {actions.success}
        </Alert>
      )}

      {credentials.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">{t('noCredentials')}</p>
        </div>
      ) : (
        <CredentialsTable credentials={credentials} actions={actions} />
      )}

      <KsefAddCredentialModal
        companyId={companyId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={() => router.refresh()}
      />
      {actions.confirmDialog}
    </div>
  )
}
