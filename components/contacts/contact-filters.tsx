'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFilterParams } from '@/lib/hooks/use-filter-params'
import { Button } from '@/components/ui/button'
import type { ContactEntity } from '@/lib/types/contacts'
import { CONTACT_UI } from './config'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  entity: ContactEntity
}

export function ContactFilters({ entity }: Props) {
  const config = CONTACT_UI[entity]
  const { isPending, getParam, updateParams, clearParams } = useFilterParams(config.settingsPath)
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
        <Label>{t('common.search')}</Label>
        <div className="mt-1 flex gap-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(`${config.namespace}.filters.searchPlaceholder`)}
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('common.search')}
          </Button>
        </div>
      </form>

      {hasActiveFilters && (
        <Button variant="outline" onClick={handleClearFilters} disabled={isPending}>
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  )
}
