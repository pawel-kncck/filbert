import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { isUserCompanyAdmin } from '@/lib/data/members'
import { getKsefCredentials } from '@/lib/data/company-settings'
import { AppShell } from '@/components/layout/app-shell'
import { CompanyInfoSection } from '@/components/company-settings/company-info-section'
import { KsefCredentialsSection } from '@/components/company-settings/ksef-credentials-section'
import { KsefFetchSection } from '@/components/company-settings/ksef-fetch-section'
import { DeleteCompanySection } from '@/components/company-settings/delete-company-section'
import { getTranslations, getLocale } from 'next-intl/server'
import type { Locale } from '@/lib/i18n/config'

type Props = {
  searchParams: Promise<{ company?: string }>
}

export default async function CompanySettingsPage({ searchParams }: Props) {
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

  // Demo company — show unavailable message
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
              {t('companySettings.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">
              {t('companySettings.demoCompanyMessage')}
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  // Fetch KSeF credentials (only visible to admins via RLS)
  const credentials = isAdmin ? await getKsefCredentials(currentCompanyId) : null

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
            {t('companySettings.title')}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
        </div>

        {!isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('companySettings.adminOnlyMessage')}
            </p>
          </div>
        )}

        <CompanyInfoSection
          companyId={currentCompanyId}
          companyName={currentCompany?.name || ''}
          companyNip={currentCompany?.nip || ''}
          isAdmin={isAdmin}
        />

        {isAdmin && (
          <KsefCredentialsSection companyId={currentCompanyId} credentials={credentials} />
        )}

        {isAdmin && (
          <KsefFetchSection companyId={currentCompanyId} hasCredentials={!!credentials} />
        )}

        {isAdmin && (
          <DeleteCompanySection
            companyId={currentCompanyId}
            companyName={currentCompany?.name || ''}
          />
        )}
      </div>
    </AppShell>
  )
}
