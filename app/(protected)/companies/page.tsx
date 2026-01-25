import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies } from '@/lib/data/companies'
import { AppShell } from '@/components/layout/app-shell'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ company?: string }>
}

export default async function CompaniesPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check for pending memberships
  const { data: pendingMemberships } = await supabase
    .from('user_companies')
    .select('company_id, companies(id, name, nip)')
    .eq('user_id', user.id)
    .eq('status', 'pending')

  const companies = await getUserCompanies(user.id)

  // If no companies at all (active or demo), redirect to onboarding
  if (companies.length === 0) {
    redirect('/onboarding')
  }

  // If only pending and no active, redirect to pending page
  const hasOnlyPending = companies.every((c) => c.is_demo) && pendingMemberships && pendingMemberships.length > 0
  if (hasOnlyPending) {
    redirect('/pending')
  }

  const currentCompanyId = params.company || companies[0]?.id || null

  return (
    <AppShell
      userEmail={user.email || ''}
      companies={companies}
      currentCompanyId={currentCompanyId}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Firmy
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Wybierz firmę i przeglądaj faktury
            </p>
          </div>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Dodaj firmę
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-white">
                    {company.name}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    NIP: {company.nip}
                  </p>
                </div>
                {company.is_demo && (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Demo
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Rola: {company.role === 'admin' ? 'Administrator' : company.role === 'member' ? 'Członek' : 'Przeglądający'}
                </span>
                <Link
                  href={`/sales?company=${company.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Otwórz
                </Link>
              </div>
            </div>
          ))}
        </div>

        {pendingMemberships && pendingMemberships.length > 0 && (
          <div>
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-white">
              Oczekujące na zatwierdzenie
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingMemberships.map((membership) => {
                const company = membership.companies as { id: string; name: string; nip: string } | null
                if (!company) return null
                return (
                  <div
                    key={company.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20"
                  >
                    <h3 className="font-medium text-zinc-900 dark:text-white">
                      {company.name}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      NIP: {company.nip}
                    </p>
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                      Oczekuje na zatwierdzenie administratora
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
