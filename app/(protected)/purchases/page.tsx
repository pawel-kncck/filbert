import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { getInvoices, getAllInvoicesForExport, PAGE_SIZE } from '@/lib/data/invoices'
import { AppShell } from '@/components/layout/app-shell'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { InvoiceStats } from '@/components/invoices/invoice-stats'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'
import { Pagination } from '@/components/invoices/pagination'
import { ExportButton } from '@/components/invoices/export-button'
import { getTranslations, getLocale } from 'next-intl/server'
import type { Locale } from '@/lib/i18n/config'

type Props = {
  searchParams: Promise<{
    company?: string
    page?: string
    search?: string
    from?: string
    to?: string
  }>
}

export default async function PurchasesPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const t = await getTranslations()
  const locale = await getLocale() as Locale

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

  const currentPage = parseInt(params.page || '1', 10)
  const filters = {
    search: params.search,
    dateFrom: params.from,
    dateTo: params.to,
  }

  const { invoices, totalCount, totalNet, totalVat, totalGross } = await getInvoices(
    currentCompanyId,
    'purchase',
    { page: currentPage, filters }
  )

  // Get all invoices for export (with current filters)
  const allInvoices = await getAllInvoicesForExport(currentCompanyId, 'purchase', filters)

  const currentCompany = companies.find((c) => c.id === currentCompanyId)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
      currentLocale={locale}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t('invoices.purchases.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {currentCompany?.name}
            </p>
          </div>
          <ExportButton
            invoices={allInvoices}
            type="purchase"
            companyName={currentCompany?.name || 'firma'}
          />
        </div>

        <InvoiceFilters type="purchase" />

        <InvoiceStats
          totalCount={totalCount}
          totalNet={totalNet}
          totalVat={totalVat}
          totalGross={totalGross}
        />

        <InvoiceTable invoices={invoices} type="purchase" />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>
    </AppShell>
  )
}
