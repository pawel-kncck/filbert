'use client'

import { useTranslations } from 'next-intl'
import { CustomerActions } from './customer-actions'
import type { Customer } from '@/lib/types/database'

type Props = {
  customers: Customer[]
  companyId: string
  isAdmin: boolean
}

export function CustomersTable({ customers, companyId, isAdmin }: Props) {
  const t = useTranslations('customers')

  if (customers.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <svg
          className="mx-auto h-12 w-12 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('table.empty')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                {t('table.name')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                {t('table.nip')}
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 md:table-cell">
                {t('table.address')}
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 lg:table-cell">
                {t('table.email')}
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 lg:table-cell">
                {t('table.phone')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    {customer.name}
                    {customer.is_synced && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {t('table.syncedBadge')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {customer.nip || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 md:table-cell">
                  {customer.address || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  {customer.email || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  {customer.phone || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <CustomerActions customer={customer} companyId={companyId} isAdmin={isAdmin} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
