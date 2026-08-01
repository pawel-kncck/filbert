'use client'

import { useTranslations } from 'next-intl'
import type { Contact, ContactEntity } from '@/lib/types/contacts'
import { ContactActions } from './contact-actions'
import { CONTACT_UI } from './config'

type Props = {
  entity: ContactEntity
  contacts: Contact[]
  companyId: string
  isAdmin: boolean
}

export function ContactsTable({ entity, contacts, companyId, isAdmin }: Props) {
  const config = CONTACT_UI[entity]
  const t = useTranslations(config.namespace)

  if (contacts.length === 0) {
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
            d={config.emptyIconPath}
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
            {contacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    {contact.name}
                    {contact.is_synced && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {t('table.syncedBadge')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {contact.nip || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 md:table-cell">
                  {contact.address || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  {contact.email || '—'}
                </td>
                <td className="hidden px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  {contact.phone || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <ContactActions
                    entity={entity}
                    contact={contact}
                    companyId={companyId}
                    isAdmin={isAdmin}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
