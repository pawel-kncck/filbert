import { Member } from '@/lib/data/members'
import { MemberActions } from './member-actions'

type Props = {
  members: Member[]
  companyId: string
  currentUserId: string
  isCurrentUserAdmin: boolean
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Aktywny',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  },
  pending: {
    label: 'Oczekujący',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
}

export function MembersTable({ members, companyId, currentUserId, isCurrentUserAdmin }: Props) {
  const pendingMembers = members.filter((m) => m.status === 'pending')
  const activeMembers = members.filter((m) => m.status === 'active')

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-zinc-600 dark:text-zinc-400">Brak członków</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending members */}
      {pendingMembers.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-medium text-zinc-900 dark:text-white">
            Oczekujące prośby ({pendingMembers.length})
          </h3>
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20">
            <table className="min-w-full divide-y divide-amber-200 dark:divide-amber-900">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    ID użytkownika
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Data prośby
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 dark:divide-amber-900">
                {pendingMembers.map((member) => (
                  <tr key={member.user_id}>
                    <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                      <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-700">
                        {member.user_id.slice(0, 8)}...
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MemberActions
                        member={member}
                        companyId={companyId}
                        currentUserId={currentUserId}
                        isCurrentUserAdmin={isCurrentUserAdmin}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active members */}
      <div>
        <h3 className="mb-3 text-lg font-medium text-zinc-900 dark:text-white">
          Aktywni członkowie ({activeMembers.length})
        </h3>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  ID użytkownika
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Dołączył
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Rola
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {activeMembers.map((member) => {
                const status = statusLabels[member.status]
                const isCurrentUser = member.user_id === currentUserId
                return (
                  <tr key={member.user_id}>
                    <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-700">
                          {member.user_id.slice(0, 8)}...
                        </code>
                        {isCurrentUser && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            Ty
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MemberActions
                        member={member}
                        companyId={companyId}
                        currentUserId={currentUserId}
                        isCurrentUserAdmin={isCurrentUserAdmin}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
