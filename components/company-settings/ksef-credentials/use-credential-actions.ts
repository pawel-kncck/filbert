'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import type { KsefCredentials } from '@/lib/types/database'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'

const FEEDBACK_TIMEOUT_MS = 3000

/**
 * Row-level actions for the KSeF credentials table: re-verify against KSeF,
 * toggle the default credential, and delete.
 *
 * Each mutation refreshes the server component that supplied the rows, so the
 * table itself stays stateless. `verifyingId`/`deletingId` drive the per-row
 * spinners; only one row can be busy at a time in practice.
 */
export function useCredentialActions(companyId: string) {
  const t = useTranslations('companySettings.ksef')
  const tErrors = useTranslations('companySettings.errors')
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()

  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clearFeedback = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const reportSuccess = useCallback((message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), FEEDBACK_TIMEOUT_MS)
  }, [])

  const credentialUrl = useCallback(
    (credential: KsefCredentials) =>
      `/api/companies/${companyId}/ksef-credentials/${credential.id}`,
    [companyId]
  )

  const verify = useCallback(
    async (credential: KsefCredentials) => {
      setVerifyingId(credential.id)
      clearFeedback()

      try {
        const res = await fetch(`/api/companies/${companyId}/ksef-credentials/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentialId: credential.id }),
        })

        const data = await res.json()

        if (!data.valid) {
          setError(data.error || tErrors('generic'))
          return
        }

        reportSuccess(t('verifySuccess'))
        router.refresh()
      } catch {
        setError(tErrors('connection'))
      } finally {
        setVerifyingId(null)
      }
    },
    [clearFeedback, companyId, reportSuccess, router, t, tErrors]
  )

  const toggleDefault = useCallback(
    async (credential: KsefCredentials) => {
      clearFeedback()

      try {
        const res = await fetch(credentialUrl(credential), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefault: !credential.is_default }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error?.message || tErrors('generic'))
          return
        }

        reportSuccess(t('defaultSet'))
        router.refresh()
      } catch {
        setError(tErrors('connection'))
      }
    },
    [clearFeedback, credentialUrl, reportSuccess, router, t, tErrors]
  )

  const remove = useCallback(
    async (credential: KsefCredentials) => {
      if (!(await confirm({ description: t('actions.deleteConfirm') }))) return

      setDeletingId(credential.id)
      clearFeedback()

      try {
        const res = await fetch(credentialUrl(credential), { method: 'DELETE' })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error?.message || tErrors('generic'))
          return
        }

        reportSuccess(t('removed'))
        router.refresh()
      } catch {
        setError(tErrors('connection'))
      } finally {
        setDeletingId(null)
      }
    },
    [clearFeedback, confirm, credentialUrl, reportSuccess, router, t, tErrors]
  )

  return {
    error,
    success,
    verifyingId,
    deletingId,
    verify,
    toggleDefault,
    remove,
    confirmDialog,
  }
}

export type CredentialActions = ReturnType<typeof useCredentialActions>
