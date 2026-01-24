import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { getInvoices } from '@/lib/data/invoices'
import { AppShell } from '@/components/layout/app-shell'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { InvoiceStats } from '@/components/invoices/invoice-stats'

type Props = {
  searchParams: Promise<{ company?: string }>
}

export default async function SalesPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

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

  const { invoices, totalCount, totalNet, totalVat, totalGross } = await getInvoices(
    currentCompanyId,
    'sales'
  )

  const currentCompany = companies.find((c) => c.id === currentCompanyId)

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Faktury sprzedażowe
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {currentCompany?.name}
          </p>
        </div>

        <InvoiceStats
          totalCount={totalCount}
          totalNet={totalNet}
          totalVat={totalVat}
          totalGross={totalGross}
        />

        <InvoiceTable invoices={invoices} type="sales" />
      </div>
    </AppShell>
  )
}
