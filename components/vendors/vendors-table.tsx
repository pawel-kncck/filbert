'use client'

import { useTranslations } from 'next-intl'
import { VendorActions } from './vendor-actions'
import type { Vendor } from '@/lib/types/database'

type Props = {
  vendors: Vendor[]
  companyId: string
  isAdmin: boolean
}

export function VendorsTable({ vendors, companyId, isAdmin }: Props) {
  const t = useTranslations('vendors')

  if (vendors.length === 0) {
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
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
            {vendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    {vendor.name}
                    {vendor.is_synced && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {t('table.syncedBadge')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {vendor.nip || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 md:table-cell">
                  {vendor.address || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  {vendor.email || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  {vendor.phone || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <VendorActions vendor={vendor} companyId={companyId} isAdmin={isAdmin} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
