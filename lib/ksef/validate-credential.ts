import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, KsefCredentials } from '@/lib/types/database'
import { KsefAuthError } from './auth'
import { KsefApiClient } from './api-client'
import { authenticateKsefClient } from './authenticate-client'
import type { KsefEnvironment } from './types'

/**
 * Credential verification against the live KSeF API. Each function
 * returns a plain result for the route layer to shape into a response.
 */

export type CredentialValidationResult = {
  valid: boolean
  permissions?: string[]
  message?: string
  error?: string
  code?: string
}

/**
 * Re-verifies a stored credential: authenticates, queries granted
 * permissions, and writes the outcome back to the credential row.
 */
export async function reverifyStoredCredential(
  supabase: SupabaseClient<Database>,
  credentialId: string,
  companyId: string,
  nip: string
): Promise<CredentialValidationResult | { notFound: true }> {
  const { data: credential, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key'
    )
    .eq('id', credentialId)
    .eq('company_id', companyId)
    .single()

  if (error || !credential) {
    return { notFound: true }
  }

  if (credential.auth_method === 'token' && !credential.token) {
    return { valid: false, error: 'No token stored for this credential' }
  }
  if (
    credential.auth_method === 'certificate' &&
    (!credential.certificate_pem || !credential.encrypted_private_key)
  ) {
    return { valid: false, error: 'No certificate stored for this credential' }
  }

  try {
    const client = await authenticateKsefClient(credential as KsefCredentials, nip)
    const permissions = await client.queryPersonalPermissions(nip)

    await supabase
      .from('company_ksef_credentials')
      .update({
        validation_status: 'valid',
        validated_at: new Date().toISOString(),
        validation_error: null,
        granted_permissions: permissions,
      })
      .eq('id', credentialId)

    return { valid: true, permissions, message: 'Credentials verified successfully' }
  } catch (err) {
    const errorMessage = err instanceof KsefAuthError ? err.message : 'Failed to verify credentials'

    await supabase
      .from('company_ksef_credentials')
      .update({
        validation_status: 'invalid',
        validated_at: new Date().toISOString(),
        validation_error: errorMessage,
        granted_permissions: [],
      })
      .eq('id', credentialId)

    return {
      valid: false,
      error: errorMessage,
      ...(err instanceof KsefAuthError && { code: err.code }),
    }
  }
}

/** Validates a not-yet-saved token against KSeF. */
export async function validateTokenCredential(
  nip: string,
  environment: KsefEnvironment,
  token: string
): Promise<CredentialValidationResult> {
  const client = new KsefApiClient(environment)

  try {
    await client.authenticate(nip, token.trim())
    const permissions = await client.queryPersonalPermissions(nip)

    return { valid: true, permissions, message: 'Successfully connected to KSeF' }
  } catch (error) {
    if (error instanceof KsefAuthError) {
      return { valid: false, error: error.message, code: error.code }
    }
    return { valid: false, error: 'Failed to validate credentials' }
  }
}

/** Validates a not-yet-saved certificate + key pair against KSeF. */
export async function validateCertificateCredential(
  nip: string,
  environment: KsefEnvironment,
  certificatePem: string,
  privateKeyPem: string
): Promise<CredentialValidationResult> {
  const client = new KsefApiClient(environment)

  try {
    await client.authenticateWithCert(nip, certificatePem, privateKeyPem)
    const permissions = await client.queryPersonalPermissions(nip)

    return { valid: true, permissions, message: 'Successfully connected to KSeF with certificate' }
  } catch (error) {
    if (error instanceof KsefAuthError) {
      return { valid: false, error: error.message, code: error.code }
    }

    const detail = error instanceof Error ? error.message : 'Unknown error'
    console.error('[KSeF Credentials] Certificate auth failed:', detail)
    return { valid: false, error: `Failed to validate certificate credentials: ${detail}` }
  }
}
