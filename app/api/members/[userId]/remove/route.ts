import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError } from '@/lib/api/middleware'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const { companyId } = await request.json()

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  // Prevent removal of the last admin
  const { data: admins } = await auth.supabase
    .from('user_companies')
    .select('user_id')
    .eq('company_id', auth.companyId)
    .eq('role', 'admin')
    .eq('status', 'active')

  if (admins && admins.length === 1 && admins[0]?.user_id === userId) {
    return apiError('LAST_ADMIN', 'Cannot remove the last administrator', 400)
  }

  const { error } = await auth.supabase
    .from('user_companies')
    .delete()
    .eq('company_id', auth.companyId)
    .eq('user_id', userId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
