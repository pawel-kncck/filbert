import { isUserCompanyAdmin } from '@/lib/data/members'
import { requirePageCompanyContext } from '@/lib/data/page-context'
import { getVendors, getMissingVendorsCount, VENDORS_PAGE_SIZE } from '@/lib/data/vendors'
import { AppShell } from '@/components/layout/app-shell'
import { VendorsTable } from '@/components/vendors/vendors-table'
import { VendorFilters } from '@/components/vendors/vendor-filters'
import { AddVendorButton } from '@/components/vendors/add-vendor-button'
import { MissingVendorsAlert } from '@/components/vendors/missing-vendors-alert'
import { Pagination } from '@/components/invoices/pagination'
import { getTranslations } from 'next-intl/server'

type Props = {
  searchParams: Promise<{ company?: string; page?: string; search?: string }>
}

export default async function VendorsSettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const t = await getTranslations()
  const { user, locale, companies, currentCompanyId, currentCompany } =
    await requirePageCompanyContext(params.company)

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
