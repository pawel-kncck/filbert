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

  const { error } = await auth.supabase
    .from('user_companies')
    .update({ status: 'active' })
    .eq('company_id', auth.companyId)
    .eq('user_id', userId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
