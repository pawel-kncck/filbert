import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'

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

  // Verify the credential belongs to this company
  const { data: existing, error: findError } = await auth.supabase
    .from('company_ksef_credentials')
    .select('id, company_id')
    .eq('id', credentialId)
    .eq('company_id', auth.companyId)
    .single()

  if (findError || !existing) {
    return badRequest('Credential not found')
  }

  const body = await request.json()
  const { name, validationStatus, validationError, validatedAt, isDefault } = body

  const updateData: Record<string, unknown> = {}

  if (name !== undefined) {
    updateData.name = name || null
  }

  if (validationStatus !== undefined) {
    updateData.validation_status = validationStatus
  }

  if (validationError !== undefined) {
    updateData.validation_error = validationError || null
  }

  if (validatedAt !== undefined) {
    updateData.validated_at = validatedAt
  }

  if (isDefault !== undefined) {
    if (isDefault) {
      // Clear is_default on all other credentials for this company
      await auth.supabase
        .from('company_ksef_credentials')
        .update({ is_default: false })
        .eq('company_id', auth.companyId)
        .neq('id', credentialId)
    }
    updateData.is_default = isDefault
  }

  if (Object.keys(updateData).length === 0) {
    return badRequest('No fields to update')
  }

  const { data, error } = await auth.supabase
    .from('company_ksef_credentials')
    .update(updateData)
    .eq('id', credentialId)
    .select('id, validation_status, validation_error, validated_at, name, is_default')
    .single()

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, credential: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; credentialId: string }> }
) {
  const { companyId, credentialId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  // Verify the credential belongs to this company
  const { data: existing, error: findError } = await auth.supabase
    .from('company_ksef_credentials')
    .select('id, company_id')
    .eq('id', credentialId)
    .eq('company_id', auth.companyId)
    .single()

  if (findError || !existing) {
    return badRequest('Credential not found')
  }

  const { error } = await auth.supabase
    .from('company_ksef_credentials')
    .delete()
    .eq('id', credentialId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
