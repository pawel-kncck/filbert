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

const VALID_ENVIRONMENTS = ['test', 'demo', 'prod'] as const

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

async function handleTokenSave(request: NextRequest, auth: AdminContext) {
  const body = await request.json()
  const { token, environment } = body

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return badRequest('Token is required')
  }

  if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  const { error } = await auth.supabase.from('company_ksef_credentials').upsert(
    {
      company_id: auth.companyId,
      auth_method: 'token' as const,
      token: token.trim(),
      environment: environment || 'test',
      certificate_pem: null,
      encrypted_private_key: null,
    },
    { onConflict: 'company_id' }
  )

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
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

  const { error } = await auth.supabase.from('company_ksef_credentials').upsert(
    {
      company_id: auth.companyId,
      auth_method: 'certificate' as const,
      token: null,
      environment: (environment as 'test' | 'demo' | 'prod') || 'test',
      certificate_pem: certificatePem,
      encrypted_private_key: encryptedPrivateKey,
    },
    { onConflict: 'company_id' }
  )

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, authMethod: 'certificate' })
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
