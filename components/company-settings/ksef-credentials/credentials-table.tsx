'use client'

import { useTranslations } from 'next-intl'
import {
  RefreshCwIcon,
  Trash2Icon,
  KeyIcon,
  FileTextIcon,
  StarIcon,
  ShieldCheckIcon,
} from 'lucide-react'

import type { KsefCredentials } from '@/lib/types/database'
import { useFormatters } from '@/lib/hooks/use-formatters'
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
import { Tooltip } from '@/components/ui/tooltip'
import type { CredentialActions } from './use-credential-actions'

/** Permission scopes KSeF can grant; anything else is shown verbatim. */
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

export function CredentialsTable({
  credentials,
  actions,
}: {
  credentials: KsefCredentials[]
  actions: CredentialActions
}) {
  const t = useTranslations('companySettings.ksef')
  const { formatDate } = useFormatters()

  return (
    <Table containerClassName="rounded-none border-0 bg-transparent dark:bg-transparent">
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
                label={credential.is_default ? t('actions.removeDefault') : t('actions.setDefault')}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => actions.toggleDefault(credential)}
                  className="rounded"
                >
                  <StarIcon
                    className={`h-4 w-4 ${
                      credential.is_default
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-zinc-300 hover:text-yellow-500 dark:text-zinc-600'
                    }`}
                  />
                </Button>
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
            <TableCell>
              <StatusBadge status={credential.validation_status} />
            </TableCell>
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
                {formatLastVerified(credential.validated_at, t('table.never'))}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Tooltip label={t('actions.verify')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => actions.verify(credential)}
                    disabled={actions.verifyingId === credential.id}
                    className="rounded"
                  >
                    {actions.verifyingId === credential.id ? (
                      <RefreshCwIcon className="h-4 w-4 animate-spin text-zinc-500" />
                    ) : (
                      <ShieldCheckIcon className="h-4 w-4 text-zinc-500 hover:text-blue-600" />
                    )}
                  </Button>
                </Tooltip>
                <Tooltip label={t('actions.delete')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => actions.remove(credential)}
                    disabled={actions.deletingId === credential.id}
                    className="rounded"
                  >
                    {actions.deletingId === credential.id ? (
                      <RefreshCwIcon className="h-4 w-4 animate-spin text-zinc-500" />
                    ) : (
                      <Trash2Icon className="h-4 w-4 text-zinc-400 hover:text-red-600" />
                    )}
                  </Button>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('companySettings.ksef')

  const tone =
    status === 'valid'
      ? {
          badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
          dot: 'bg-green-500',
          label: t('status.valid'),
        }
      : status === 'invalid'
        ? {
            badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            dot: 'bg-red-500',
            label: t('status.invalid'),
          }
        : {
            badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            dot: 'bg-yellow-500',
            label: t('status.pending'),
          }

  return (
    <Badge className={tone.badge}>
      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${tone.dot}`} />
      {tone.label}
    </Badge>
  )
}

/** Coarse "x min/hours/days ago" — deliberately not localised, as before. */
function formatLastVerified(date: string | null, neverLabel: string) {
  if (!date) return neverLabel
  try {
    const diffMs = Date.now() - new Date(date).getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } catch {
    return neverLabel
  }
}
