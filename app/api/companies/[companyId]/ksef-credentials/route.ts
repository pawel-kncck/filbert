import { NextRequest, NextResponse } from 'next/server'
import {
  requireAdminAuth,
  isApiError,
  apiError,
  badRequest,
  type AdminContext,
} from '@/lib/api/middleware'
import { encryptPrivateKey, CertificateError } from '@/lib/ksef/certificate-crypto'
import { parseCertificateUpload } from '@/lib/ksef/certificate-upload'
import { isKsefEnvironment } from '@/lib/ksef/types'
import {
  upsertTokenCredential,
  upsertCertificateCredential,
  deleteCredential,
  type UpsertResult,
} from '@/lib/data/ksef-credentials'
import { X509Certificate } from 'node:crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const { data, error } = await auth.supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, validated_at, validation_status, validation_error, name, granted_permissions, is_default, certificate_expires_at, created_at, updated_at'
    )
    .eq('company_id', auth.companyId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ credentials: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const contentType = request.headers.get('content-type') || ''

  // Certificate upload via multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    return handleCertificateUpload(request, auth)
  }

  // Token auth via JSON (backward compatible)
  return handleTokenSave(request, auth)
}

function upsertErrorResponse(result: Extract<UpsertResult, { ok: false }>) {
  if (result.reason === 'duplicate') {
    return badRequest(result.message)
  }
  return apiError('INTERNAL_ERROR', result.message, 500)
}

async function handleTokenSave(request: NextRequest, auth: AdminContext) {
  const body = await request.json()
  const { token, environment, name, validationStatus, validationError, grantedPermissions } = body

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return badRequest('Token is required')
  }

  const env = environment || 'prod'
  if (!isKsefEnvironment(env)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  const result = await upsertTokenCredential(auth.supabase, auth.companyId, {
    token,
    environment: env,
    name,
    validationStatus,
    validationError,
    grantedPermissions: Array.isArray(grantedPermissions) ? grantedPermissions : undefined,
  })

  if (!result.ok) {
    return upsertErrorResponse(result)
  }

  return NextResponse.json({
    success: true,
    id: result.id,
    ...(result.updated && { updated: true }),
  })
}

async function handleCertificateUpload(request: NextRequest, auth: AdminContext) {
  try {
    return await handleCertificateUploadInner(request, auth)
  } catch (err) {
    console.error('[KSeF Credentials] Unhandled error in certificate upload:', err)
    return apiError(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Unexpected error saving certificate',
      500
    )
  }
}

async function handleCertificateUploadInner(request: NextRequest, auth: AdminContext) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Invalid form data')
  }

  const parsed = await parseCertificateUpload(formData)
  if (!parsed.ok) {
    if (parsed.reason === 'config_error') {
      return apiError('CONFIG_ERROR', parsed.message, 500)
    }
    return badRequest(parsed.message)
  }

  const {
    certificatePem,
    environment,
    name,
    validationStatus,
    validationError,
    grantedPermissions,
  } = parsed

  const env = environment || 'prod'
  if (!isKsefEnvironment(env)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  let encryptedPrivateKey: string
  try {
    encryptedPrivateKey = encryptPrivateKey(parsed.privateKeyPem)
  } catch (err) {
    if (err instanceof CertificateError && err.code === 'MISSING_ENCRYPTION_KEY') {
      return apiError(
        'CONFIG_ERROR',
        'Server is not configured for certificate authentication',
        500
      )
    }
    throw err
  }

  // Extract certificate expiry date
  let certificateExpiresAt: string | null = null
  try {
    const x509 = new X509Certificate(certificatePem)
    certificateExpiresAt = new Date(x509.validTo).toISOString()
  } catch {
    // Non-fatal: skip expiry extraction if parsing fails
    console.warn('[KSeF Credentials] Failed to extract certificate expiry date')
  }

  const result = await upsertCertificateCredential(auth.supabase, auth.companyId, {
    certificatePem,
    encryptedPrivateKey,
    certificateExpiresAt,
    environment: env,
    name,
    validationStatus,
    validationError,
    grantedPermissions,
  })

  if (!result.ok) {
    return upsertErrorResponse(result)
  }

  return NextResponse.json({
    success: true,
    id: result.id,
    authMethod: 'certificate',
    ...(result.updated && { updated: true }),
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const url = new URL(request.url)
  const credentialId = url.searchParams.get('id')

  if (!credentialId) {
    return badRequest('Credential ID is required')
  }

  const result = await deleteCredential(auth.supabase, auth.companyId, credentialId)

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return badRequest(result.message)
    }
    return apiError('INTERNAL_ERROR', result.message, 500)
  }

  return NextResponse.json({ success: true })
}
