import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'

const VALID_ENVIRONMENTS = ['test', 'demo', 'prod'] as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const body = await request.json()
  const { token, environment } = body

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return badRequest('Token is required')
  }

  if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  // Upsert credentials (insert or update if already exists)
  const { error } = await auth.supabase.from('company_ksef_credentials').upsert(
    {
      company_id: auth.companyId,
      token: token.trim(),
      environment: environment || 'test',
    },
    { onConflict: 'company_id' }
  )

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

  const { error } = await auth.supabase
    .from('company_ksef_credentials')
    .delete()
    .eq('company_id', auth.companyId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
