import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { isUserCompanyAdmin } from '@/lib/data/members'
import { getVendors, getMissingVendorsCount, VENDORS_PAGE_SIZE } from '@/lib/data/vendors'
import { AppShell } from '@/components/layout/app-shell'
import { VendorsTable } from '@/components/vendors/vendors-table'
import { VendorFilters } from '@/components/vendors/vendor-filters'
import { AddVendorButton } from '@/components/vendors/add-vendor-button'
import { MissingVendorsAlert } from '@/components/vendors/missing-vendors-alert'
import { Pagination } from '@/components/invoices/pagination'
import { getTranslations, getLocale } from 'next-intl/server'
import type { Locale } from '@/lib/i18n/config'

type Props = {
  searchParams: Promise<{ company?: string; page?: string; search?: string }>
}

export default async function VendorsSettingsPage({ searchParams }: Props) {
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
              {t('vendors.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">{t('vendors.demoCompanyMessage')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const filters = { search: params.search }

  const [{ vendors, totalCount }, missingCount] = await Promise.all([
    getVendors(currentCompanyId, { page, filters }),
    getMissingVendorsCount(currentCompanyId),
  ])

  const totalPages = Math.ceil(totalCount / VENDORS_PAGE_SIZE)

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
              {t('vendors.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>
          <AddVendorButton companyId={currentCompanyId} />
        </div>

        <MissingVendorsAlert missingCount={missingCount} companyId={currentCompanyId} />

        <VendorFilters />

        <VendorsTable vendors={vendors} companyId={currentCompanyId} isAdmin={isAdmin} />

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={VENDORS_PAGE_SIZE}
          translationNamespace="vendors.pagination"
        />
      </div>
    </AppShell>
  )
}
