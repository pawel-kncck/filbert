'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CustomerFormDialog } from './customer-form-dialog'
import type { Customer } from '@/lib/types/database'

type Props = {
  customer: Customer
  companyId: string
  isAdmin: boolean
}

export function CustomerActions({ customer, companyId, isAdmin }: Props) {
  const router = useRouter()
  const t = useTranslations('customers')
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleShowInvoices = () => {
    router.push(`/sales?search=${encodeURIComponent(customer.name)}`)
  }

  const handleCreateInvoice = () => {
    router.push(`/sales/new?customer=${customer.id}`)
  }

  const handleDelete = async () => {
    if (!confirm(t('actions.deleteConfirm'))) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
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
    <>
      <div className="flex items-center gap-1">
        {error && <span className="text-xs text-red-600">{error}</span>}

        {/* Show invoices */}
        <button
          onClick={handleShowInvoices}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-700"
          title={t('actions.showInvoices')}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </button>

        {/* Create invoice */}
        <button
          onClick={handleCreateInvoice}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-green-600 dark:hover:bg-zinc-700"
          title={t('actions.createInvoice')}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Edit */}
        <button
          onClick={() => setEditOpen(true)}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
          title={t('actions.editCustomer')}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        {/* Delete (admin only) */}
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-700"
            title={t('actions.deleteCustomer')}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        companyId={companyId}
        customer={customer}
      />
    </>
  )
}
