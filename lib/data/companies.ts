/**
 * Company membership lookup and selection of the "current" company.
 *
 * Server-only: reads request cookies via `@/lib/supabase/server` and
 * `next/headers`. RLS on `user_companies` and `companies` scopes reads to the
 * caller; the `userId` argument narrows within that, it does not grant access.
 *
 * @module
 */
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

/** A company the user can open, annotated with their role in it. */
export type CompanyWithRole = {
  id: string
  name: string
  /** Polish tax ID, 10 digits. */
  nip: string
  /** Demo companies are readable by every signed-in user. */
  is_demo: boolean
  /** Absent only if the membership row lacked a role; demo companies get `'viewer'`. */
  role?: 'admin' | 'member' | 'viewer'
}

/**
 * Lists the companies a user can open: their active memberships, plus every
 * demo company.
 *
 * Demo companies are appended with the `viewer` role and de-duplicated against
 * real memberships, so a user who genuinely belongs to a demo company keeps
 * their actual role. Pending (non-`active`) memberships are excluded — those
 * users are sent to `/pending`.
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
export async function getUserCompanies(userId: string): Promise<CompanyWithRole[]> {
  const supabase = await createClient()

  // Get user's companies with their roles
  const { data: memberships, error: membershipsError } = await supabase
    .from('user_companies')
    .select('company_id, role, status, companies(id, name, nip, is_demo)')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (membershipsError) {
    Sentry.captureException(membershipsError)
    throw membershipsError
  }

  const userCompanies: CompanyWithRole[] = (memberships || [])
    .filter((m) => m.companies)
    .map((m) => {
      const company = m.companies as { id: string; name: string; nip: string; is_demo: boolean }
      return {
        ...company,
        role: m.role,
      }
    })

  // Get all demo companies
  const { data: demoCompanies, error: demoError } = await supabase
    .from('companies')
    .select('id, name, nip, is_demo')
    .eq('is_demo', true)
    .order('name')

  if (demoError) {
    Sentry.captureException(demoError)
    throw demoError
  }

  if (demoCompanies) {
    // Add demo companies that aren't already in user's companies
    for (const demoCompany of demoCompanies) {
      if (!userCompanies.find((c) => c.id === demoCompany.id)) {
        userCompanies.push({
          ...demoCompany,
          role: 'viewer',
        })
      }
    }
  }

  return userCompanies
}

/**
 * Resolves which company a page should open, in precedence order:
 *
 * 1. `requestedCompanyId` (the `?company=` URL param), if the user has access
 * 2. the `selectedCompany` cookie, if the user still has access
 * 3. the first non-demo company
 * 4. the first company of any kind
 *
 * Both the param and the cookie are checked against `companies` before use, so
 * a stale cookie or a hand-edited URL falls through to the default rather than
 * selecting a company the user cannot open.
 *
 * @param companies The caller's accessible companies, from {@link getUserCompanies}.
 * @param requestedCompanyId Value of the `company` search param, or `null`.
 * @returns The chosen company id, or `null` when the user has no companies —
 *   which callers treat as "redirect to onboarding".
 */
export async function getDefaultCompanyId(
  companies: CompanyWithRole[],
  requestedCompanyId: string | null
): Promise<string | null> {
  if (companies.length === 0) return null

  // If a specific company is requested via URL param and user has access, use it
  if (requestedCompanyId) {
    const hasAccess = companies.some((c) => c.id === requestedCompanyId)
    if (hasAccess) return requestedCompanyId
  }

  // Check for saved company selection in cookie
  const cookieStore = await cookies()
  const savedCompanyId = cookieStore.get('selectedCompany')?.value
  if (savedCompanyId) {
    const hasAccess = companies.some((c) => c.id === savedCompanyId)
    if (hasAccess) return savedCompanyId
  }

  // Default to first non-demo company, or demo if no other
  const nonDemo = companies.find((c) => !c.is_demo)
  return nonDemo?.id || companies[0]?.id || null
}
