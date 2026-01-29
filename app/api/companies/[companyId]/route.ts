import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const body = await request.json()
  const { name } = body

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return badRequest('Company name is required')
  }

  const { error } = await auth.supabase
    .from('companies')
    .update({ name: name.trim() })
    .eq('id', auth.companyId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  // Prevent deleting demo companies
  const { data: company } = await auth.supabase
    .from('companies')
    .select('is_demo')
    .eq('id', auth.companyId)
    .single()

  if (company?.is_demo) {
    return badRequest('Cannot delete demo company')
  }

  const { error } = await auth.supabase.from('companies').delete().eq('id', auth.companyId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
