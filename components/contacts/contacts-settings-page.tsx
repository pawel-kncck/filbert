import { getTranslations } from 'next-intl/server'
import { isUserCompanyAdmin } from '@/lib/data/members'
import { requirePageCompanyContext } from '@/lib/data/page-context'
import { getContacts, getMissingContactsCount, CONTACTS_PAGE_SIZE } from '@/lib/data/contacts'
import type { ContactEntity } from '@/lib/types/contacts'
import { AppShell } from '@/components/layout/app-shell'
import { ContactsTable } from '@/components/contacts/contacts-table'
import { ContactFilters } from '@/components/contacts/contact-filters'
import { AddContactButton } from '@/components/contacts/add-contact-button'
import { MissingContactsAlert } from '@/components/contacts/missing-contacts-alert'
import { Pagination } from '@/components/invoices/pagination'
import { CONTACT_UI } from '@/components/contacts/config'

type Props = {
  entity: ContactEntity
  searchParams: Promise<{ company?: string; page?: string; search?: string }>
}

export async function ContactsSettingsPage({ entity, searchParams }: Props) {
  const config = CONTACT_UI[entity]
  const params = await searchParams
  const t = await getTranslations(config.namespace)
  const { user, locale, companies, currentCompanyId, currentCompany } =
    await requirePageCompanyContext(params.company)

  const isAdmin = await isUserCompanyAdmin(user.id, currentCompanyId)

  // Demo companies don't expose contact management
  if (currentCompany?.is_demo) {
    return (
      <AppShell
        userEmail={user.email || ''}
        companies={companies}
        currentCompanyId={currentCompanyId}
        currentLocale={locale}
      >
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">{t('demoCompanyMessage')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const filters = { search: params.search }

  const [{ contacts, totalCount }, missingCount] = await Promise.all([
    getContacts(entity, currentCompanyId, { page, filters }),
    getMissingContactsCount(entity, currentCompanyId),
  ])

  const totalPages = Math.ceil(totalCount / CONTACTS_PAGE_SIZE)

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
      currentLocale={locale}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>
          <AddContactButton entity={entity} companyId={currentCompanyId} />
        </div>

        <MissingContactsAlert
          entity={entity}
          missingCount={missingCount}
          companyId={currentCompanyId}
        />

        <ContactFilters entity={entity} />

        <ContactsTable
          entity={entity}
          contacts={contacts}
          companyId={currentCompanyId}
          isAdmin={isAdmin}
        />

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={CONTACTS_PAGE_SIZE}
          translationNamespace={`${config.namespace}.pagination`}
        />
      </div>
    </AppShell>
  )
}
