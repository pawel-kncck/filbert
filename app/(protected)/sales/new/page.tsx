import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { getInvoiceById } from '@/lib/data/invoices'
import { getInvoiceItems } from '@/lib/data/invoice-items'
import { getCustomerById } from '@/lib/data/customers'
import { AppShell } from '@/components/layout/app-shell'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { getTranslations, getLocale } from 'next-intl/server'
import type { Locale } from '@/lib/i18n/config'

type Props = {
  searchParams: Promise<{
    company?: string
    copy?: string
    customer?: string
  }>
}

export default async function NewSalesInvoicePage({ searchParams }: Props) {
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

  // Check if the current company is a demo company
  const currentCompany = companies.find((c) => c.id === currentCompanyId)
  if (currentCompany?.is_demo) {
    redirect(`/sales?company=${currentCompanyId}`)
  }

  // Check user has at least member role
  if (currentCompany?.role === 'viewer') {
    redirect(`/sales?company=${currentCompanyId}`)
  }

  // Load copy-from invoice data if requested
  let copyInvoice = null
  let copyItems: Awaited<ReturnType<typeof getInvoiceItems>> = []
  if (params.copy) {
    copyInvoice = await getInvoiceById(params.copy, currentCompanyId)
    if (copyInvoice) {
      copyItems = await getInvoiceItems(copyInvoice.id)
    }
  }

  // Load customer data if pre-filling from customer list
  let prefillCustomerName = ''
  let prefillCustomerNip = ''
  if (params.customer) {
    const customer = await getCustomerById(params.customer, currentCompanyId)
    if (customer) {
      prefillCustomerName = customer.name
      prefillCustomerNip = customer.nip || ''
    }
  }

  const pageTitle = params.copy ? t('invoices.form.copyTitle') : t('invoices.form.title')

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
      currentLocale={locale}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/sales?company=${currentCompanyId}`}
            className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t('invoices.detail.backToList')}
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{pageTitle}</h1>

        <InvoiceForm
          companyId={currentCompanyId}
          copyFrom={copyInvoice}
          copyItems={copyItems}
          prefillCustomerName={prefillCustomerName}
          prefillCustomerNip={prefillCustomerNip}
        />
      </div>
    </AppShell>
  )
}
