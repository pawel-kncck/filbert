'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFilterParams } from '@/lib/hooks/use-filter-params'

export function CustomerFilters() {
  const { isPending, getParam, updateParams, clearParams } = useFilterParams('/settings/customers')
  const t = useTranslations()

  const [search, setSearch] = useState(getParam('search'))

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search })
  }

  const handleClearFilters = () => {
    setSearch('')
    clearParams(['search'])
  }

  const hasActiveFilters = !!search

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-end">
      <form onSubmit={handleSearchSubmit} className="flex-1">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('common.search')}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customers.filters.searchPlaceholder')}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? '...' : t('common.search')}
          </button>
        </div>
      </form>

      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          disabled={isPending}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {t('common.clearFilters')}
        </button>
      )}
    </div>
  )
}
