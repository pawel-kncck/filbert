import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'
import { updateCredential, deleteCredential } from '@/lib/data/ksef-credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; credentialId: string }> }
) {
  const { companyId, credentialId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const { data, error } = await auth.supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, validated_at, validation_status, validation_error, name, created_at, updated_at'
    )
    .eq('id', credentialId)
    .eq('company_id', auth.companyId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return badRequest('Credential not found')
    }
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ credential: data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; credentialId: string }> }
) {
  const { companyId, credentialId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const body = await request.json()
  const { name, validationStatus, validationError, validatedAt, isDefault } = body

  const result = await updateCredential(auth.supabase, auth.companyId, credentialId, {
    name,
    validationStatus,
    validationError,
    validatedAt,
    isDefault,
  })

  if (!result.ok) {
    if (result.reason === 'db_error') {
      return apiError('INTERNAL_ERROR', result.message, 500)
    }
    return badRequest(result.message)
  }

  return NextResponse.json({ success: true, credential: result.credential })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; credentialId: string }> }
) {
  const { companyId, credentialId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const result = await deleteCredential(auth.supabase, auth.companyId, credentialId)

  if (!result.ok) {
    if (result.reason === 'db_error') {
      return apiError('INTERNAL_ERROR', result.message, 500)
    }
    return badRequest(result.message)
  }

  return NextResponse.json({ success: true })
}
