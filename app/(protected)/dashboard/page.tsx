import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type Membership = {
  company_id: string
  role: 'admin' | 'member' | 'viewer'
  status: 'active' | 'pending'
  companies: {
    id: string
    name: string
    nip: string
    is_demo: boolean
  } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has any companies
  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company_id, role, status, companies(id, name, nip, is_demo)')
    .eq('user_id', user.id) as { data: Membership[] | null }

  // If no companies, redirect to onboarding
  if (!memberships || memberships.length === 0) {
    redirect('/onboarding')
  }

  // Check if all memberships are pending
  const activeMemberships = memberships.filter(m => m.status === 'active')
  const pendingMemberships = memberships.filter(m => m.status === 'pending')

  if (activeMemberships.length === 0 && pendingMemberships.length > 0) {
    redirect('/pending')
  }

  // Get demo company for all users
  const { data: demoCompany } = await supabase
    .from('companies')
    .select('id, name, nip')
    .eq('is_demo', true)
    .single() as { data: { id: string; name: string; nip: string } | null }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Filbert
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-white">
          Twoje firmy
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeMemberships.map((membership) => {
            if (!membership.companies) return null
            return (
              <CompanyCard
                key={membership.companies.id}
                company={membership.companies}
                role={membership.role}
              />
            )
          })}

          {demoCompany && (
            <CompanyCard
              key={demoCompany.id}
              company={{ ...demoCompany, is_demo: true }}
              role="viewer"
              isDemo
            />
          )}
        </div>

        {pendingMemberships.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-medium text-zinc-900 dark:text-white">
              Oczekujące na zatwierdzenie
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingMemberships.map((membership) => {
                if (!membership.companies) return null
                return (
                  <div
                    key={membership.companies.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20"
                  >
                    <h4 className="font-medium text-zinc-900 dark:text-white">
                      {membership.companies.name}
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      NIP: {membership.companies.nip}
                    </p>
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                      Oczekuje na zatwierdzenie
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function CompanyCard({
  company,
  role,
  isDemo = false,
}: {
  company: { id: string; name: string; nip: string; is_demo?: boolean }
  role: string
  isDemo?: boolean
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-white">
            {company.name}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            NIP: {company.nip}
          </p>
        </div>
        {isDemo && (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Demo
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Rola: {role === 'admin' ? 'Administrator' : role === 'member' ? 'Członek' : 'Przeglądający'}
        </span>
        <Link
          href={`/sales?company=${company.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Otwórz
        </Link>
      </div>
    </div>
  )
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        Wyloguj
      </button>
    </form>
  )
}
