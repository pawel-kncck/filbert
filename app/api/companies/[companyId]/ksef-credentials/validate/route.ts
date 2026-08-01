import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'
import { parseCertificateUpload } from '@/lib/ksef/certificate-upload'
import { isKsefEnvironment } from '@/lib/ksef/types'
import {
  reverifyStoredCredential,
  validateTokenCredential,
  validateCertificateCredential,
} from '@/lib/ksef/validate-credential'

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
    const result = await reverifyStoredCredential(
      auth.supabase,
      body.credentialId,
      auth.companyId,
      company.nip
    )

    if ('notFound' in result) {
      return badRequest('Credential not found')
    }

    return NextResponse.json(result)
  }

  // Token validation via JSON
  const { token, environment } = body

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return badRequest('Token is required')
  }

  if (!isKsefEnvironment(environment)) {
    return badRequest('Invalid environment. Must be test, demo, or prod')
  }

  return NextResponse.json(await validateTokenCredential(company.nip, environment, token))
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

  return NextResponse.json(
    await validateCertificateCredential(
      nip,
      parsed.environment,
      parsed.certificatePem,
      parsed.privateKeyPem
    )
  )
}
