'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Member } from '@/lib/data/members'

type Props = {
  member: Member
  companyId: string
  currentUserId: string
  isCurrentUserAdmin: boolean
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  member: 'Członek',
  viewer: 'Przeglądający',
}

export function MemberActions({ member, companyId, currentUserId, isCurrentUserAdmin }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCurrentUser = member.user_id === currentUserId
  const isPending = member.status === 'pending'

  const handleAction = async (action: 'approve' | 'reject' | 'remove' | 'role', role?: string) => {
    setLoading(true)
    setError(null)

    try {
      const endpoint = role
        ? `/api/members/${member.user_id}/role`
        : `/api/members/${member.user_id}/${action}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Wystąpił błąd')
        return
      }

      router.refresh()
    } catch {
      setError('Wystąpił błąd połączenia')
    } finally {
      setLoading(false)
    }
  }

  if (!isCurrentUserAdmin) {
    return (
      <span className="text-sm text-zinc-500">
        {roleLabels[member.role]}
      </span>
    )
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? '...' : 'Zatwierdź'}
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Odrzuć
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
      <select
        value={member.role}
        onChange={(e) => handleAction('role', e.target.value)}
        disabled={loading || isCurrentUser}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700"
      >
        <option value="admin">Administrator</option>
        <option value="member">Członek</option>
        <option value="viewer">Przeglądający</option>
      </select>
      {!isCurrentUser && (
        <button
          onClick={() => {
            if (confirm('Czy na pewno chcesz usunąć tego członka?')) {
              handleAction('remove')
            }
          }}
          disabled={loading}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-700"
          title="Usuń członka"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  )
}
