'use client'

import { useTranslations } from 'next-intl'
import type { Contact, ContactEntity } from '@/lib/types/contacts'
import { ContactActions } from './contact-actions'
import { CONTACT_UI } from './config'
import { EmptyState, EmptyStateIcon, EmptyStateDescription } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

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
      <EmptyState>
        <EmptyStateIcon path={config.emptyIconPath} />
        <EmptyStateDescription className="text-base">{t('table.empty')}</EmptyStateDescription>
      </EmptyState>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('table.name')}</TableHead>
          <TableHead>{t('table.nip')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('table.address')}</TableHead>
          <TableHead className="hidden lg:table-cell">{t('table.email')}</TableHead>
          <TableHead className="hidden lg:table-cell">{t('table.phone')}</TableHead>
          <TableHead className="text-right">{t('table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
            <TableCell className="text-zinc-900 dark:text-white">
              <div className="flex items-center gap-2">
                {contact.name}
                {contact.is_synced && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    {t('table.syncedBadge')}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-zinc-600 dark:text-zinc-400">{contact.nip || '—'}</TableCell>
            <TableCell className="hidden text-zinc-600 dark:text-zinc-400 md:table-cell">
              {contact.address || '—'}
            </TableCell>
            <TableCell className="hidden text-zinc-600 dark:text-zinc-400 lg:table-cell">
              {contact.email || '—'}
            </TableCell>
            <TableCell className="hidden text-zinc-600 dark:text-zinc-400 lg:table-cell">
              {contact.phone || '—'}
            </TableCell>
            <TableCell className="text-right">
              <ContactActions
                entity={entity}
                contact={contact}
                companyId={companyId}
                isAdmin={isAdmin}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
