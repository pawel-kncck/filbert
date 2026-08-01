import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getUserCompanies, getDefaultCompanyId, type CompanyWithRole } from '@/lib/data/companies'
import type { Locale } from '@/lib/i18n/config'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/** Everything a protected server page needs about the signed-in user's session. */
export type PageCompanyContext = {
  user: User
  /** Request-scoped server client; queries through it stay RLS-enforced. */
  supabase: SupabaseClient<Database>
  locale: Locale
  /** Every company the user can open, for the company switcher. */
  companies: CompanyWithRole[]
  /** The active company. Guaranteed non-null — the helper redirects otherwise. */
  currentCompanyId: string
  /** The matching entry from `companies`; carries the user's role. */
  currentCompany: CompanyWithRole | undefined
}

/**
 * Shared preamble for protected server pages: requires a signed-in user with at
 * least one company, and resolves the active company from the `?company=`
 * search param (falling back to the user's default).
 *
 * Redirects to `/login` when signed out and to `/onboarding` when the user has
 * no companies, so callers can rely on the returned context being complete.
 * Because `redirect()` throws, nothing after a failed check runs — there is no
 * error branch for callers to handle.
 *
 * Server components only.
 *
 * @param companyParam Value of the page's `company` search param, if any.
 */
export async function requirePageCompanyContext(
  companyParam?: string | null
): Promise<PageCompanyContext> {
  const supabase = await createClient()
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

  const currentCompanyId = await getDefaultCompanyId(companies, companyParam || null)

  if (!currentCompanyId) {
    redirect('/onboarding')
  }

  return {
    user,
    supabase,
    locale,
    companies,
    currentCompanyId,
    currentCompany: companies.find((c) => c.id === currentCompanyId),
  }
}
