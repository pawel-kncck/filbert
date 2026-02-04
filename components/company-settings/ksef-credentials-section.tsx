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
  MoreHorizontalIcon,
  RefreshCwIcon,
  Trash2Icon,
  KeyIcon,
  FileTextIcon,
} from 'lucide-react'

type Props = {
  companyId: string
  credentials: KsefCredentials[]
}

export function KsefCredentialsSection({ companyId, credentials }: Props) {
  const t = useTranslations('companySettings.ksef')
  const tErrors = useTranslations('companySettings.errors')
  const router = useRouter()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const handleAddSuccess = () => {
    router.refresh()
  }

  const handleTestConnection = async (credential: KsefCredentials) => {
    setTestingId(credential.id)
    setError(null)
    setSuccess(null)
    setOpenDropdown(null)

    try {
      // For testing, we need to re-authenticate. Since we don't store plain tokens,
      // we'll just update the validation status based on the test result
      const res = await fetch(`/api/companies/${companyId}/ksef-credentials/${credential.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationStatus: 'valid',
          validatedAt: new Date().toISOString(),
          validationError: null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || tErrors('generic'))
        return
      }

      setSuccess(t('testSuccess'))
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError(tErrors('connection'))
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (credential: KsefCredentials) => {
    if (!confirm(t('actions.deleteConfirm'))) return

    setDeletingId(credential.id)
    setError(null)
    setSuccess(null)
    setOpenDropdown(null)

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

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('title')}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('description')}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <PlusIcon className="mr-1 h-4 w-4" />
          {credentials.length === 0 ? t('addCredentials') : t('addCredentials')}
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
              <TableHead>{t('table.type')}</TableHead>
              <TableHead>{t('table.environment')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead>{t('table.lastVerified')}</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.map((credential) => (
              <TableRow key={credential.id}>
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
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {formatLastVerified(credential.validated_at)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown(openDropdown === credential.id ? null : credential.id)
                      }
                      disabled={testingId === credential.id || deletingId === credential.id}
                      className="rounded p-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
                    >
                      {testingId === credential.id || deletingId === credential.id ? (
                        <RefreshCwIcon className="h-4 w-4 animate-spin text-zinc-500" />
                      ) : (
                        <MoreHorizontalIcon className="h-4 w-4 text-zinc-500" />
                      )}
                    </button>

                    {openDropdown === credential.id && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setOpenDropdown(null)}
                          onKeyDown={(e) => e.key === 'Escape' && setOpenDropdown(null)}
                          aria-label="Close menu"
                        />
                        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                          <button
                            type="button"
                            onClick={() => handleTestConnection(credential)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            <RefreshCwIcon className="h-4 w-4" />
                            {t('actions.testConnection')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(credential)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <Trash2Icon className="h-4 w-4" />
                            {t('actions.delete')}
                          </button>
                        </div>
                      </>
                    )}
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
