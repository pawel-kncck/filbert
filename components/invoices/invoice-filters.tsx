'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFilterParams } from '@/lib/hooks/use-filter-params'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  type: 'sales' | 'purchase'
}

export function InvoiceFilters({ type }: Props) {
  const basePath = type === 'sales' ? '/sales' : '/purchases'
  const { isPending, getParam, updateParams, clearParams } = useFilterParams(basePath)
  const t = useTranslations()

  const [search, setSearch] = useState(getParam('search'))
  const [dateFrom, setDateFrom] = useState(getParam('from'))
  const [dateTo, setDateTo] = useState(getParam('to'))

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search })
  }

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    updateParams({ from, to })
  }

  const handleClearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    clearParams(['search', 'from', 'to'])
  }

  const hasActiveFilters = search || dateFrom || dateTo

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-end">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex-1">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('common.search')}
        </label>
        <div className="mt-1 flex gap-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('invoices.filters.searchPlaceholder')}
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('common.search')}
          </Button>
        </div>
      </form>

      {/* Date range */}
      <div className="flex gap-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('common.from')}
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateChange(e.target.value, dateTo)}
            className="mt-1 w-auto"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('common.to')}
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateChange(dateFrom, e.target.value)}
            className="mt-1 w-auto"
          />
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={handleClearFilters} disabled={isPending}>
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  )
}
