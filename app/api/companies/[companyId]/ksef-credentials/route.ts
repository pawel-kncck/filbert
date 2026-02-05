import { NextRequest, NextResponse } from 'next/server'
import {
  requireAdminAuth,
  isApiError,
  apiError,
  badRequest,
  type AdminContext,
} from '@/lib/api/middleware'
import {
  parsePkcs12,
  parsePemCertificate,
  encryptPrivateKey,
  CertificateError,
} from '@/lib/ksef/certificate-crypto'
import { X509Certificate } from 'node:crypto'

const VALID_ENVIRONMENTS = ['test', 'demo', 'prod'] as const

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

type ValidationStatus = 'valid' | 'invalid' | 'pending'

function parseValidationStatus(status: string | null | undefined): ValidationStatus {
  if (status === 'valid' || status === 'invalid') return status
  return 'pending'
}

async function handleTokenSave(request: NextRequest, auth: AdminContext) {
  const body = await request.json()
  const { token, environment, name, validationStatus, validationError } = body

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return badRequest('Token is required')
  }

  if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  const env = environment || 'test'
  const status = parseValidationStatus(validationStatus)

  // Check for existing credential with same environment + auth_method
  const { data: existing } = await auth.supabase
    .from('company_ksef_credentials')
    .select('id')
    .eq('company_id', auth.companyId)
    .eq('environment', env)
    .eq('auth_method', 'token')
    .single()

  if (existing) {
    // Update existing credential
    const { data, error } = await auth.supabase
      .from('company_ksef_credentials')
      .update({
        token: token.trim(),
        name: name || null,
        validated_at: status === 'valid' ? new Date().toISOString() : null,
        validation_status: status,
        validation_error: validationError || null,
      })
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      return apiError('INTERNAL_ERROR', error.message, 500)
    }

    return NextResponse.json({ success: true, id: data.id, updated: true })
  }

  // Insert new credential
  const { data, error } = await auth.supabase
    .from('company_ksef_credentials')
    .insert({
      company_id: auth.companyId,
      auth_method: 'token' as const,
      token: token.trim(),
      environment: env,
      name: name || null,
      validated_at: status === 'valid' ? new Date().toISOString() : null,
      validation_status: status,
      validation_error: validationError || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return badRequest('Credential for this environment and auth method already exists')
    }
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, id: data.id })
}

async function handleCertificateUpload(request: NextRequest, auth: AdminContext) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Invalid form data')
  }

  const certificateFile = formData.get('certificate') as File | null
  const certificateFormat = (formData.get('certificateFormat') as string) || 'pkcs12'
  const password = formData.get('certificatePassword') as string | null
  const privateKeyPassword = formData.get('privateKeyPassword') as string | null
  const privateKeyFile = formData.get('privateKey') as File | null
  const environment = formData.get('environment') as string | null
  const name = formData.get('name') as string | null
  const validationStatus = formData.get('validationStatus') as string | null
  const validationError = formData.get('validationError') as string | null

  if (!certificateFile) {
    return badRequest('Certificate file is required')
  }

  if (certificateFormat === 'pkcs12' && !password) {
    return badRequest('Certificate password is required for PKCS#12 files')
  }

  if (certificateFormat === 'pem' && !privateKeyFile) {
    return badRequest('Private key file is required for PEM format')
  }

  if (
    environment &&
    !VALID_ENVIRONMENTS.includes(environment as (typeof VALID_ENVIRONMENTS)[number])
  ) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  let certificatePem: string
  let encryptedPrivateKey: string

  try {
    if (certificateFormat === 'pem') {
      // Parse PEM format (separate certificate and private key files)
      const certContent = await certificateFile.text()
      const keyContent = await privateKeyFile!.text()
      const parsed = parsePemCertificate(certContent, keyContent, privateKeyPassword || undefined)
      certificatePem = parsed.certificatePem
      encryptedPrivateKey = encryptPrivateKey(parsed.privateKeyPem)
    } else {
      // Parse PKCS#12 format
      const buffer = Buffer.from(await certificateFile.arrayBuffer())
      const parsed = parsePkcs12(buffer, password!)
      certificatePem = parsed.certificatePem
      encryptedPrivateKey = encryptPrivateKey(parsed.privateKeyPem)
    }
  } catch (err) {
    if (err instanceof CertificateError) {
      if (err.code === 'MISSING_ENCRYPTION_KEY') {
        return apiError(
          'CONFIG_ERROR',
          'Server is not configured for certificate authentication',
          500
        )
      }
      return badRequest(err.message)
    }
    return badRequest(
      certificateFormat === 'pem'
        ? 'Failed to parse certificate or private key file.'
        : 'Failed to parse certificate file. Check the file and password.'
    )
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

  const env = (environment as 'test' | 'demo' | 'prod') || 'test'

  // Check for existing credential with same environment + auth_method
  const { data: existing } = await auth.supabase
    .from('company_ksef_credentials')
    .select('id')
    .eq('company_id', auth.companyId)
    .eq('environment', env)
    .eq('auth_method', 'certificate')
    .single()

  const status = parseValidationStatus(validationStatus)

  if (existing) {
    // Update existing credential
    const { data, error } = await auth.supabase
      .from('company_ksef_credentials')
      .update({
        certificate_pem: certificatePem,
        encrypted_private_key: encryptedPrivateKey,
        name: name || null,
        validated_at: status === 'valid' ? new Date().toISOString() : null,
        validation_status: status,
        validation_error: validationError || null,
        certificate_expires_at: certificateExpiresAt,
      })
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      return apiError('INTERNAL_ERROR', error.message, 500)
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      authMethod: 'certificate',
      updated: true,
    })
  }

  // Insert new credential
  const { data, error } = await auth.supabase
    .from('company_ksef_credentials')
    .insert({
      company_id: auth.companyId,
      auth_method: 'certificate' as const,
      token: null,
      environment: env,
      certificate_pem: certificatePem,
      encrypted_private_key: encryptedPrivateKey,
      name: name || null,
      validated_at: status === 'valid' ? new Date().toISOString() : null,
      validation_status: status,
      validation_error: validationError || null,
      certificate_expires_at: certificateExpiresAt,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return badRequest('Credential for this environment and auth method already exists')
    }
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, id: data.id, authMethod: 'certificate' })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  // Get credential ID from query params
  const url = new URL(request.url)
  const credentialId = url.searchParams.get('id')

  if (!credentialId) {
    return badRequest('Credential ID is required')
  }

  // Verify the credential belongs to this company before deleting
  const { data: credential } = await auth.supabase
    .from('company_ksef_credentials')
    .select('id, company_id')
    .eq('id', credentialId)
    .single()

  if (!credential || credential.company_id !== auth.companyId) {
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
