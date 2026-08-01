import { getCompanyMembers, isUserCompanyAdmin } from '@/lib/data/members'
import { requirePageCompanyContext } from '@/lib/data/page-context'
import { AppShell } from '@/components/layout/app-shell'
import { MembersTable } from '@/components/members/members-table'
import { getTranslations } from 'next-intl/server'

type Props = {
  searchParams: Promise<{ company?: string }>
}

export default async function MembersSettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const t = await getTranslations()
  const { user, locale, companies, currentCompanyId, currentCompany } =
    await requirePageCompanyContext(params.company)

  const isAdmin = await isUserCompanyAdmin(user.id, currentCompanyId)
  const members = await getCompanyMembers(currentCompanyId)

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
              {t('members.title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">{t('members.demoCompanyMessage')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
      currentLocale={locale}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('members.title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentCompany?.name}</p>
        </div>

        {!isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('members.adminOnlyMessage')}
            </p>
          </div>
        )}

        <MembersTable
          members={members}
          companyId={currentCompanyId}
          currentUserId={user.id}
          isCurrentUserAdmin={isAdmin}
        />
      </div>
    </AppShell>
  )
}
