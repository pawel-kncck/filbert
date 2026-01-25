import { createClient } from '@/lib/supabase/server'

export type Member = {
  user_id: string
  role: 'admin' | 'member' | 'viewer'
  status: 'active' | 'pending'
  created_at: string
}

export async function getCompanyMembers(companyId: string): Promise<Member[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_companies')
    .select('user_id, role, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching members:', error)
    return []
  }

  return (data || []).map((m) => ({
    user_id: m.user_id,
    role: m.role as 'admin' | 'member' | 'viewer',
    status: m.status as 'active' | 'pending',
    created_at: m.created_at,
  }))
}

export async function isUserCompanyAdmin(
  userId: string,
  companyId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('user_companies')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single()

  return data?.role === 'admin'
}
