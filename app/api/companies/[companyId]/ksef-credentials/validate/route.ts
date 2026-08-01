import { NextRequest, NextResponse } from 'next/server'
import {
  requireAdminAuth,
  isApiError,
  apiError,
  badRequest,
  type AdminContext,
} from '@/lib/api/middleware'
import { KsefAuthError } from '@/lib/ksef/auth'
import { KsefApiClient } from '@/lib/ksef/api-client'
import { decryptPrivateKey } from '@/lib/ksef/certificate-crypto'
import { parseCertificateUpload } from '@/lib/ksef/certificate-upload'
import { isKsefEnvironment, type KsefEnvironment } from '@/lib/ksef/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  // Get company NIP for authentication
  const { data: company, error: companyError } = await auth.supabase
    .from('companies')
    .select('nip')
    .eq('id', auth.companyId)
    .single()

  if (companyError || !company) {
    return apiError('INTERNAL_ERROR', 'Company not found', 500)
  }

  const contentType = request.headers.get('content-type') || ''

  // Certificate validation via multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    return validateCertificate(request, company.nip)
  }

  // JSON body — could be token validation or re-verify of existing credential
  const body = await request.json()

  if (body.credentialId) {
    return reverifyExistingCredential(body.credentialId, auth.companyId, company.nip, auth.supabase)
  }

  // Token validation via JSON
  return validateToken(body, company.nip)
}

async function reverifyExistingCredential(
  credentialId: string,
  companyId: string,
  nip: string,
  supabase: AdminContext['supabase']
) {
  // Load credential from DB
  const { data: credential, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key'
    )
    .eq('id', credentialId)
    .eq('company_id', companyId)
    .single()

  if (error || !credential) {
    return badRequest('Credential not found')
  }

  const env = credential.environment as KsefEnvironment
  const client = new KsefApiClient(env)

  try {
    // Authenticate based on auth method
    if (credential.auth_method === 'token') {
      if (!credential.token) {
        return NextResponse.json({ valid: false, error: 'No token stored for this credential' })
      }
      await client.authenticate(nip, credential.token)
    } else {
      if (!credential.certificate_pem || !credential.encrypted_private_key) {
        return NextResponse.json({
          valid: false,
          error: 'No certificate stored for this credential',
        })
      }
      const privateKeyPem = decryptPrivateKey(credential.encrypted_private_key)
      await client.authenticateWithCert(nip, credential.certificate_pem, privateKeyPem)
    }

    // Query permissions
    const permissions = await client.queryPersonalPermissions(nip)

    // Update DB with results
    await supabase
      .from('company_ksef_credentials')
      .update({
        validation_status: 'valid',
        validated_at: new Date().toISOString(),
        validation_error: null,
        granted_permissions: permissions,
      })
      .eq('id', credentialId)

    return NextResponse.json({
      valid: true,
      permissions,
      message: 'Credentials verified successfully',
    })
  } catch (err) {
    const errorMessage = err instanceof KsefAuthError ? err.message : 'Failed to verify credentials'

    // Update DB with failure
    await supabase
      .from('company_ksef_credentials')
      .update({
        validation_status: 'invalid',
        validated_at: new Date().toISOString(),
        validation_error: errorMessage,
        granted_permissions: [],
      })
      .eq('id', credentialId)

    return NextResponse.json({
      valid: false,
      error: errorMessage,
      ...(err instanceof KsefAuthError && { code: err.code }),
    })
  }
}

async function validateToken(body: Record<string, unknown>, nip: string) {
  const { token, environment } = body

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return badRequest('Token is required')
  }

  if (!isKsefEnvironment(environment)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  const client = new KsefApiClient(environment)

  try {
    await client.authenticate(nip, token.trim())

    // Also query permissions for new credentials
    const permissions = await client.queryPersonalPermissions(nip)

    return NextResponse.json({
      valid: true,
      permissions,
      message: 'Successfully connected to KSeF',
    })
  } catch (error) {
    if (error instanceof KsefAuthError) {
      return NextResponse.json({
        valid: false,
        error: error.message,
        code: error.code,
      })
    }

    return NextResponse.json({
      valid: false,
      error: 'Failed to validate credentials',
    })
  }
}

async function validateCertificate(request: NextRequest, nip: string) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Invalid form data')
  }

  const parsed = await parseCertificateUpload(formData)
  if (!parsed.ok) {
    switch (parsed.reason) {
      case 'bad_request':
        return badRequest(parsed.message)
      case 'config_error':
        return apiError('CONFIG_ERROR', parsed.message, 500)
      case 'parse_error':
        return NextResponse.json({
          valid: false,
          error: parsed.message,
          ...(parsed.code && { code: parsed.code }),
        })
    }
  }

  if (!isKsefEnvironment(parsed.environment)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  const client = new KsefApiClient(parsed.environment)

  try {
    await client.authenticateWithCert(nip, parsed.certificatePem, parsed.privateKeyPem)

    // Also query permissions for new credentials
    const permissions = await client.queryPersonalPermissions(nip)

    return NextResponse.json({
      valid: true,
      permissions,
      message: 'Successfully connected to KSeF with certificate',
    })
  } catch (error) {
    if (error instanceof KsefAuthError) {
      return NextResponse.json({
        valid: false,
        error: error.message,
        code: error.code,
      })
    }

    const detail = error instanceof Error ? error.message : 'Unknown error'
    console.error('[KSeF Credentials] Certificate auth failed:', detail)
    return NextResponse.json({
      valid: false,
      error: `Failed to validate certificate credentials: ${detail}`,
    })
  }
}
