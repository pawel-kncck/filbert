import { createClient } from '@/lib/supabase/server'

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
  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company_id, role, status, companies(id, name, nip, is_demo)')
    .eq('user_id', userId)
    .eq('status', 'active')

  const userCompanies: CompanyWithRole[] = (memberships || [])
    .filter((m) => m.companies)
    .map((m) => {
      const company = m.companies as { id: string; name: string; nip: string; is_demo: boolean }
      return {
        ...company,
        role: m.role,
      }
    })

  // Get demo company
  const { data: demoCompany } = await supabase
    .from('companies')
    .select('id, name, nip, is_demo')
    .eq('is_demo', true)
    .single()

  if (demoCompany) {
    // Only add demo if not already in user's companies
    if (!userCompanies.find((c) => c.id === demoCompany.id)) {
      userCompanies.push({
        ...demoCompany,
        role: 'viewer',
      })
    }
  }

  return userCompanies
}

export async function getDefaultCompanyId(
  companies: CompanyWithRole[],
  requestedCompanyId: string | null
): Promise<string | null> {
  if (companies.length === 0) return null

  // If a specific company is requested and user has access, use it
  if (requestedCompanyId) {
    const hasAccess = companies.some((c) => c.id === requestedCompanyId)
    if (hasAccess) return requestedCompanyId
  }

  // Default to first non-demo company, or demo if no other
  const nonDemo = companies.find((c) => !c.is_demo)
  return nonDemo?.id || companies[0]?.id || null
}
