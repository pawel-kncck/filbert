import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'

const VALID_ROLES = ['admin', 'member', 'viewer']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const { companyId, role } = await request.json()

  if (!role) {
    return badRequest('Role is required')
  }

  if (!VALID_ROLES.includes(role)) {
    return badRequest('Invalid role')
  }

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  // Prevent changing the last admin's role to non-admin
  if (role !== 'admin') {
    const { data: admins } = await auth.supabase
      .from('user_companies')
      .select('user_id')
      .eq('company_id', auth.companyId)
      .eq('role', 'admin')
      .eq('status', 'active')

    if (admins && admins.length === 1 && admins[0].user_id === userId) {
      return apiError('LAST_ADMIN', 'Cannot change role of the last administrator', 400)
    }
  }

  const { error } = await auth.supabase
    .from('user_companies')
    .update({ role })
    .eq('company_id', auth.companyId)
    .eq('user_id', userId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
