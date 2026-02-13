'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { KsefCredentials } from '@/lib/types/database'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KsefAddCredentialModal } from './ksef-add-credential-modal'
import {
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  KeyIcon,
  FileTextIcon,
  StarIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'

type Props = {
  companyId: string
  credentials: KsefCredentials[]
}

export function KsefCredentialsSection({ companyId, credentials }: Props) {
  const t = useTranslations('companySettings.ksef')
  const tErrors = useTranslations('companySettings.errors')
  const router = useRouter()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAddSuccess = () => {
    router.refresh()
  }

  const handleVerify = async (credential: KsefCredentials) => {
    setVerifyingId(credential.id)
    setError(null)
    setSuccess(null)

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

      setSuccess(t('verifySuccess'))
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError(tErrors('connection'))
    } finally {
      setVerifyingId(null)
    }
  }

  const handleSetDefault = async (credential: KsefCredentials) => {
    setError(null)
    setSuccess(null)

    const newDefault = !credential.is_default

    try {
      const res = await fetch(`/api/companies/${companyId}/ksef-credentials/${credential.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: newDefault }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || tErrors('generic'))
        return
      }

      setSuccess(t('defaultSet'))
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError(tErrors('connection'))
    }
  }

  const handleDelete = async (credential: KsefCredentials) => {
    if (!confirm(t('actions.deleteConfirm'))) return

    setDeletingId(credential.id)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/companies/${companyId}/ksef-credentials/${credential.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || tErrors('generic'))
        return
      }

      setSuccess(t('removed'))
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError(tErrors('connection'))
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
            {t('status.valid')}
          </Badge>
        )
      case 'invalid':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
            {t('status.invalid')}
          </Badge>
        )
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-500" />
            {t('status.pending')}
          </Badge>
        )
    }
  }

  const formatLastVerified = (date: string | null) => {
    if (!date) return t('table.never')
    try {
      const now = Date.now()
      const then = new Date(date).getTime()
      const diffMs = now - then
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMinutes < 1) return 'just now'
      if (diffMinutes < 60) return `${diffMinutes} min ago`
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } catch {
      return t('table.never')
    }
  }

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString()
    } catch {
      return date
    }
  }

  const PERMISSION_KEYS = [
    'InvoiceRead',
    'InvoiceWrite',
    'CredentialsRead',
    'CredentialsManage',
    'Introspection',
    'SubunitManage',
    'EnforcementOperations',
    'VatUeManage',
  ] as const

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

      {error && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-4 mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {credentials.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">{t('noCredentials')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">{t('table.default')}</TableHead>
              <TableHead>{t('table.type')}</TableHead>
              <TableHead>{t('table.environment')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead>{t('table.permissions')}</TableHead>
              <TableHead>{t('table.expires')}</TableHead>
              <TableHead>{t('table.lastVerified')}</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.map((credential) => (
              <TableRow key={credential.id}>
                <TableCell>
                  <Tooltip
                    label={
                      credential.is_default ? t('actions.removeDefault') : t('actions.setDefault')
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handleSetDefault(credential)}
                      className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <StarIcon
                        className={`h-4 w-4 ${
                          credential.is_default
                            ? 'fill-yellow-500 text-yellow-500'
                            : 'text-zinc-300 hover:text-yellow-500 dark:text-zinc-600'
                        }`}
                      />
                    </button>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {credential.auth_method === 'token' ? (
                      <KeyIcon className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <FileTextIcon className="h-4 w-4 text-zinc-500" />
                    )}
                    <span className="text-zinc-900 dark:text-white">
                      {t(`authMethods.${credential.auth_method}`)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {t(`environments.${credential.environment}`)}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(credential.validation_status)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(credential.granted_permissions || []).map((scope) => {
                      const isKnown = PERMISSION_KEYS.includes(
                        scope as (typeof PERMISSION_KEYS)[number]
                      )
                      return (
                        <span
                          key={scope}
                          className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          {isKnown ? t(`permissions.${scope}` as Parameters<typeof t>[0]) : scope}
                        </span>
                      )
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {credential.certificate_expires_at
                      ? formatDate(credential.certificate_expires_at)
                      : t('table.noExpiry')}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {formatLastVerified(credential.validated_at)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Tooltip label={t('actions.verify')}>
                      <button
                        type="button"
                        onClick={() => handleVerify(credential)}
                        disabled={verifyingId === credential.id}
                        className="rounded p-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
                      >
                        {verifyingId === credential.id ? (
                          <RefreshCwIcon className="h-4 w-4 animate-spin text-zinc-500" />
                        ) : (
                          <ShieldCheckIcon className="h-4 w-4 text-zinc-500 hover:text-blue-600" />
                        )}
                      </button>
                    </Tooltip>
                    <Tooltip label={t('actions.delete')}>
                      <button
                        type="button"
                        onClick={() => handleDelete(credential)}
                        disabled={deletingId === credential.id}
                        className="rounded p-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
                      >
                        {deletingId === credential.id ? (
                          <RefreshCwIcon className="h-4 w-4 animate-spin text-zinc-500" />
                        ) : (
                          <Trash2Icon className="h-4 w-4 text-zinc-400 hover:text-red-600" />
                        )}
                      </button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <KsefAddCredentialModal
        companyId={companyId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
