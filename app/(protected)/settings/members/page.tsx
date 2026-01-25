import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId } from '@/lib/data/companies'
import { getCompanyMembers, isUserCompanyAdmin } from '@/lib/data/members'
import { AppShell } from '@/components/layout/app-shell'
import { MembersTable } from '@/components/members/members-table'

type Props = {
  searchParams: Promise<{ company?: string }>
}

export default async function MembersSettingsPage({ searchParams }: Props) {
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

  const currentCompany = companies.find((c) => c.id === currentCompanyId)
  const isAdmin = await isUserCompanyAdmin(user.id, currentCompanyId)
  const members = await getCompanyMembers(currentCompanyId)

  // Check if this is a demo company
  if (currentCompany?.is_demo) {
    return (
      <AppShell
        userEmail={user.email || ''}
        companies={companies}
        currentCompanyId={currentCompanyId}
      >
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Zarządzanie członkami
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {currentCompany?.name}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">
              Zarządzanie członkami nie jest dostępne dla firmy demo.
            </p>
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
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Zarządzanie członkami
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {currentCompany?.name}
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Tylko administratorzy mogą zarządzać członkami firmy.
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
