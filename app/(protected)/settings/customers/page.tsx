import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { isUserCompanyAdmin } from '@/lib/data/members'
import { getCustomers, getMissingCustomersCount, CUSTOMERS_PAGE_SIZE } from '@/lib/data/customers'
import { AppShell } from '@/components/layout/app-shell'
import { CustomersTable } from '@/components/customers/customers-table'
import { CustomerFilters } from '@/components/customers/customer-filters'
import { AddCustomerButton } from '@/components/customers/add-customer-button'
import { MissingCustomersAlert } from '@/components/customers/missing-customers-alert'
import { Pagination } from '@/components/invoices/pagination'
import { getTranslations, getLocale } from 'next-intl/server'
import type { Locale } from '@/lib/i18n/config'

type Props = {
  searchParams: Promise<{ company?: string; page?: string; search?: string }>
}

export default async function CustomersSettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const companies = await getUserCompanies(user.id)

  if (companies.length === 0) {
    redirect('/onboarding')
  }

  const currentCompanyId = await getDefaultCompanyId(companies, params.company || null)

  if (!currentCompanyId) {
    redirect('/onboarding')
  }

  const currentCompany = companies.find((c) => c.id === currentCompanyId)
  const isAdmin = await isUserCompanyAdmin(user.id, currentCompanyId)

  // Check if this is a demo company
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
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t('customers.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">{t('customers.demoCompanyMessage')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const filters = { search: params.search }

  const [{ customers, totalCount }, missingCount] = await Promise.all([
    getCustomers(currentCompanyId, { page, filters }),
    getMissingCustomersCount(currentCompanyId),
  ])

  const totalPages = Math.ceil(totalCount / CUSTOMERS_PAGE_SIZE)

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
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t('customers.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>
          <AddCustomerButton companyId={currentCompanyId} />
        </div>

        <MissingCustomersAlert missingCount={missingCount} companyId={currentCompanyId} />

        <CustomerFilters />

        <CustomersTable customers={customers} companyId={currentCompanyId} isAdmin={isAdmin} />

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={CUSTOMERS_PAGE_SIZE}
          translationNamespace="customers.pagination"
        />
      </div>
    </AppShell>
  )
}
