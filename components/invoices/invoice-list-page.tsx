import { getInvoices, getAllInvoicesForExport, PAGE_SIZE } from '@/lib/data/invoices'
import { requirePageCompanyContext } from '@/lib/data/page-context'
import { AppShell } from '@/components/layout/app-shell'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { InvoiceStats } from '@/components/invoices/invoice-stats'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'
import { Pagination } from '@/components/invoices/pagination'
import { ExportButton } from '@/components/invoices/export-button'
import { getTranslations } from 'next-intl/server'

type Props = {
  type: 'sales' | 'purchase'
  searchParams: Promise<{
    company?: string
    page?: string
    search?: string
    from?: string
    to?: string
  }>
}

export async function InvoiceListPage({ type, searchParams }: Props) {
  const params = await searchParams
  const t = await getTranslations()
  const { user, locale, companies, currentCompanyId, currentCompany } =
    await requirePageCompanyContext(params.company)

  const currentPage = parseInt(params.page || '1', 10)
  const filters = {
    search: params.search,
    dateFrom: params.from,
    dateTo: params.to,
  }

  const { invoices, totalCount, totalNet, totalVat, totalGross } = await getInvoices(
    currentCompanyId,
    type,
    { page: currentPage, filters }
  )

  const allInvoices = await getAllInvoicesForExport(currentCompanyId, type, filters)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const titleKey = type === 'sales' ? 'invoices.sales.title' : 'invoices.purchases.title'

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
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t(titleKey)}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>
          <ExportButton
            invoices={allInvoices}
            type={type}
            companyName={currentCompany?.name || 'firma'}
          />
        </div>

        <InvoiceFilters type={type} />

        <InvoiceStats
          totalCount={totalCount}
          totalNet={totalNet}
          totalVat={totalVat}
          totalGross={totalGross}
        />

        <InvoiceTable invoices={invoices} type={type} />

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
