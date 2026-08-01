'use client'

import { useTranslations } from 'next-intl'
import { Member } from '@/lib/data/members'
import { useFormatters } from '@/lib/hooks/use-formatters'
import { MemberActions } from './member-actions'
import { EmptyState, EmptyStateDescription } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

type Props = {
  members: Member[]
  companyId: string
  currentUserId: string
  isCurrentUserAdmin: boolean
}

export function MembersTable({ members, companyId, currentUserId, isCurrentUserAdmin }: Props) {
  const t = useTranslations('members')
  const tCommon = useTranslations('common')
  const { formatDate: formatDateIn } = useFormatters()

  const formatDate = (dateString: string) =>
    formatDateIn(dateString, { year: 'numeric', month: 'short', day: 'numeric' })

  const statusLabels: Record<string, { label: string; className: string }> = {
    active: {
      label: t('statusActive'),
      className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    },
    pending: {
      label: t('statusPending'),
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    },
  }

  const pendingMembers = members.filter((m) => m.status === 'pending')
  const activeMembers = members.filter((m) => m.status === 'active')

  if (members.length === 0) {
    return (
      <EmptyState>
        <EmptyStateDescription className="mt-0 text-base">{t('noMembers')}</EmptyStateDescription>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending members */}
      {pendingMembers.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-medium text-zinc-900 dark:text-white">
            {t('pendingRequests', { count: pendingMembers.length })}
          </h3>
          <Table
            containerClassName="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20"
            className="divide-amber-200 dark:divide-amber-900"
          >
            <TableHeader className="bg-transparent dark:bg-transparent">
              <TableRow>
                <TableHead>{t('userId')}</TableHead>
                <TableHead>{t('requestDate')}</TableHead>
                <TableHead className="text-right">{t('actions.approve')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-amber-200 dark:divide-amber-900">
              {pendingMembers.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell className="text-zinc-900 dark:text-white">
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-700">
                      {member.user_id.slice(0, 8)}...
                    </code>
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {formatDate(member.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MemberActions
                      member={member}
                      companyId={companyId}
                      currentUserId={currentUserId}
                      isCurrentUserAdmin={isCurrentUserAdmin}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Active members */}
      <div>
        <h3 className="mb-3 text-lg font-medium text-zinc-900 dark:text-white">
          {t('activeMembers', { count: activeMembers.length })}
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('userId')}</TableHead>
              <TableHead>{t('statusActive')}</TableHead>
              <TableHead>{t('joined')}</TableHead>
              <TableHead className="text-right">{t('roles.admin').split(':')[0]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeMembers.map((member) => {
              const status = statusLabels[member.status] ?? statusLabels['active']!
              const isCurrentUser = member.user_id === currentUserId
              return (
                <TableRow key={member.user_id}>
                  <TableCell className="text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-700">
                        {member.user_id.slice(0, 8)}...
                      </code>
                      {isCurrentUser && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                          {tCommon('you')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {formatDate(member.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MemberActions
                      member={member}
                      companyId={companyId}
                      currentUserId={currentUserId}
                      isCurrentUserAdmin={isCurrentUserAdmin}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
