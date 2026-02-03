import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

export type CompanyWithRole = {
  id: string
  name: string
  nip: string
  is_demo: boolean
  role?: 'admin' | 'member' | 'viewer'
}

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
