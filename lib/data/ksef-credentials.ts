import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { KsefEnvironment } from '@/lib/ksef/types'

/**
 * Write-side data access for company_ksef_credentials. Callers are
 * expected to have verified admin access to the company (RLS enforces
 * it regardless). Functions return discriminated results for expected
 * failures and throw on unexpected database errors.
 */

type Supabase = SupabaseClient<Database>

export type ValidationStatus = 'valid' | 'invalid' | 'pending'

export function parseValidationStatus(status: string | null | undefined): ValidationStatus {
  if (status === 'valid' || status === 'invalid') return status
  return 'pending'
}

export type UpsertResult =
  | { ok: true; id: string; updated: boolean }
  | { ok: false; reason: 'duplicate' | 'db_error'; message: string }

export type TokenCredentialInput = {
  token: string
  environment: KsefEnvironment
  name?: string | null
  validationStatus?: string | null
  validationError?: string | null
  grantedPermissions?: string[] | undefined
}

/**
 * Creates or updates the token credential for (company, environment).
 */
export async function upsertTokenCredential(
  supabase: Supabase,
  companyId: string,
  input: TokenCredentialInput
): Promise<UpsertResult> {
  const status = parseValidationStatus(input.validationStatus)
  const commonFields = {
    token: input.token.trim(),
    name: input.name || null,
    validated_at: status === 'valid' ? new Date().toISOString() : null,
    validation_status: status,
    validation_error: input.validationError || null,
    ...(Array.isArray(input.grantedPermissions) && {
      granted_permissions: input.grantedPermissions,
    }),
  }

  const { data: existing } = await supabase
    .from('company_ksef_credentials')
    .select('id')
    .eq('company_id', companyId)
    .eq('environment', input.environment)
    .eq('auth_method', 'token')
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('company_ksef_credentials')
      .update(commonFields)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      return { ok: false, reason: 'db_error', message: error.message }
    }
    return { ok: true, id: data.id, updated: true }
  }

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .insert({
      company_id: companyId,
      auth_method: 'token' as const,
      environment: input.environment,
      ...commonFields,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate',
        message: 'Credential for this environment and auth method already exists',
      }
    }
    return { ok: false, reason: 'db_error', message: error.message }
  }

  await setDefaultIfOnly(supabase, companyId, data.id)

  return { ok: true, id: data.id, updated: false }
}

export type CertificateCredentialInput = {
  certificatePem: string
  encryptedPrivateKey: string
  certificateExpiresAt: string | null
  environment: KsefEnvironment
  name?: string | null
  validationStatus?: string | null
  validationError?: string | null
  grantedPermissions?: string[] | undefined
}

/**
 * Creates or updates the certificate credential for (company, environment).
 */
export async function upsertCertificateCredential(
  supabase: Supabase,
  companyId: string,
  input: CertificateCredentialInput
): Promise<UpsertResult> {
  const status = parseValidationStatus(input.validationStatus)
  const commonFields = {
    certificate_pem: input.certificatePem,
    encrypted_private_key: input.encryptedPrivateKey,
    name: input.name || null,
    validated_at: status === 'valid' ? new Date().toISOString() : null,
    validation_status: status,
    validation_error: input.validationError || null,
    certificate_expires_at: input.certificateExpiresAt,
    ...(Array.isArray(input.grantedPermissions) && {
      granted_permissions: input.grantedPermissions,
    }),
  }

  const { data: existing } = await supabase
    .from('company_ksef_credentials')
    .select('id')
    .eq('company_id', companyId)
    .eq('environment', input.environment)
    .eq('auth_method', 'certificate')
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('company_ksef_credentials')
      .update(commonFields)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      return { ok: false, reason: 'db_error', message: error.message }
    }
    return { ok: true, id: data.id, updated: true }
  }

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .insert({
      company_id: companyId,
      auth_method: 'certificate' as const,
      token: null,
      environment: input.environment,
      ...commonFields,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate',
        message: 'Credential for this environment and auth method already exists',
      }
    }
    return { ok: false, reason: 'db_error', message: error.message }
  }

  await setDefaultIfOnly(supabase, companyId, data.id)

  return { ok: true, id: data.id, updated: false }
}

/** Marks the credential as default when it's the company's only one. */
export async function setDefaultIfOnly(
  supabase: Supabase,
  companyId: string,
  credentialId: string
): Promise<void> {
  const { count } = await supabase
    .from('company_ksef_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if (count === 1) {
    await supabase
      .from('company_ksef_credentials')
      .update({ is_default: true })
      .eq('id', credentialId)
  }
}

export type CredentialUpdateInput = {
  name?: string | null
  validationStatus?: string
  validationError?: string | null
  validatedAt?: string | null
  isDefault?: boolean
}

export type CredentialUpdateResult =
  | { ok: true; credential: unknown }
  | { ok: false; reason: 'not_found' | 'no_fields' | 'db_error'; message: string }

/**
 * Partially updates a credential. Setting isDefault=true clears the
 * default flag on the company's other credentials first.
 */
export async function updateCredential(
  supabase: Supabase,
  companyId: string,
  credentialId: string,
  input: CredentialUpdateInput
): Promise<CredentialUpdateResult> {
  const { data: existing, error: findError } = await supabase
    .from('company_ksef_credentials')
    .select('id, company_id')
    .eq('id', credentialId)
    .eq('company_id', companyId)
    .single()

  if (findError || !existing) {
    return { ok: false, reason: 'not_found', message: 'Credential not found' }
  }

  const updateData: Record<string, unknown> = {}

  if (input.name !== undefined) updateData.name = input.name || null
  if (input.validationStatus !== undefined) updateData.validation_status = input.validationStatus
  if (input.validationError !== undefined)
    updateData.validation_error = input.validationError || null
  if (input.validatedAt !== undefined) updateData.validated_at = input.validatedAt

  if (input.isDefault !== undefined) {
    if (input.isDefault) {
      await supabase
        .from('company_ksef_credentials')
        .update({ is_default: false })
        .eq('company_id', companyId)
        .neq('id', credentialId)
    }
    updateData.is_default = input.isDefault
  }

  if (Object.keys(updateData).length === 0) {
    return { ok: false, reason: 'no_fields', message: 'No fields to update' }
  }

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .update(updateData)
    .eq('id', credentialId)
    .select('id, validation_status, validation_error, validated_at, name, is_default')
    .single()

  if (error) {
    return { ok: false, reason: 'db_error', message: error.message }
  }

  return { ok: true, credential: data }
}

export type CredentialDeleteResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'db_error'; message: string }

/**
 * Deletes a credential; if exactly one remains for the company it
 * becomes the default.
 */
export async function deleteCredential(
  supabase: Supabase,
  companyId: string,
  credentialId: string
): Promise<CredentialDeleteResult> {
  const { data: existing, error: findError } = await supabase
    .from('company_ksef_credentials')
    .select('id, company_id')
    .eq('id', credentialId)
    .eq('company_id', companyId)
    .single()

  if (findError || !existing) {
    return { ok: false, reason: 'not_found', message: 'Credential not found' }
  }

  const { error } = await supabase.from('company_ksef_credentials').delete().eq('id', credentialId)

  if (error) {
    return { ok: false, reason: 'db_error', message: error.message }
  }

  const { data: remaining } = await supabase
    .from('company_ksef_credentials')
    .select('id, is_default')
    .eq('company_id', companyId)

  if (remaining && remaining.length === 1 && !remaining[0]!.is_default) {
    await supabase
      .from('company_ksef_credentials')
      .update({ is_default: true })
      .eq('id', remaining[0]!.id)
  }

  return { ok: true }
}
