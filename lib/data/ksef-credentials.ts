/**
 * Write-side data access for `company_ksef_credentials`.
 *
 * A company may hold at most one credential per (environment, auth method)
 * pair, enforced by a unique constraint — hence the upsert shape below. Exactly
 * one credential per company is flagged `is_default`; the helpers here maintain
 * that invariant as credentials are added and removed.
 *
 * **Access control.** Callers are expected to have passed `requireAdminAuth`
 * for the company; RLS enforces it regardless. Every function takes the
 * request-scoped `supabase` client rather than creating one, so the route's
 * authenticated session is reused. The `companyId` argument is also matched
 * explicitly on reads, so a credential id from another company reads as
 * "not found" rather than being acted upon.
 *
 * **Secrets.** Rows in this table carry the raw KSeF token and the encrypted
 * certificate private key. Nothing here logs a row; the update path selects an
 * explicit non-secret column list for its return value, and callers must not
 * widen it to `*`.
 *
 * **Errors.** Expected failures (duplicate, not found, nothing to update) come
 * back as discriminated results for the route to shape into a 4xx; unexpected
 * database errors surface as `db_error` with the driver's message.
 *
 * @module
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { KsefEnvironment } from '@/lib/ksef/types'

type Supabase = SupabaseClient<Database>

/** Outcome of the last verification attempt against the live KSeF API. */
export type ValidationStatus = 'valid' | 'invalid' | 'pending'

/**
 * Narrows an arbitrary stored/​submitted status string to {@link ValidationStatus}.
 *
 * Anything unrecognised — including `null` and `undefined` — becomes
 * `'pending'`, so an unknown value is treated as "not yet verified" rather
 * than being mistaken for a successful validation.
 */
export function parseValidationStatus(status: string | null | undefined): ValidationStatus {
  if (status === 'valid' || status === 'invalid') return status
  return 'pending'
}

/** `updated` distinguishes an overwrite of an existing credential from a create. */
export type UpsertResult =
  | { ok: true; id: string; updated: boolean }
  | { ok: false; reason: 'duplicate' | 'db_error'; message: string }

export type TokenCredentialInput = {
  /** Raw KSeF authorization token; trimmed before storage. */
  token: string
  environment: KsefEnvironment
  /** Optional user-facing label shown in the credentials table. */
  name?: string | null
  /** Coerced via {@link parseValidationStatus}; unknown values become `'pending'`. */
  validationStatus?: string | null
  validationError?: string | null
  /** Permission scopes returned by KSeF. Omit to leave the stored value untouched. */
  grantedPermissions?: string[] | undefined
}

/**
 * Creates or updates the token credential for (company, environment).
 *
 * `validated_at` is stamped only when the status is `'valid'`, and cleared
 * otherwise, so the timestamp always refers to a successful check.
 * `grantedPermissions` is written only when an array is supplied — passing
 * `undefined` preserves whatever is already stored rather than blanking it.
 *
 * On create, {@link setDefaultIfOnly} promotes the credential when it is the
 * company's first.
 *
 * @returns `duplicate` if the unique constraint fires despite the existence
 *   check (a concurrent create), `db_error` for anything else.
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
  /** Public X.509 certificate, PEM-encoded. Not secret. */
  certificatePem: string
  /**
   * Private key already encrypted with AES-256-GCM under
   * `KSEF_CERTIFICATE_ENCRYPTION_KEY`. This function stores what it is given —
   * it does not encrypt, so callers must never pass a plaintext key.
   */
  encryptedPrivateKey: string
  /** Certificate `notAfter`, ISO-8601, used for expiry warnings. */
  certificateExpiresAt: string | null
  environment: KsefEnvironment
  /** Optional user-facing label shown in the credentials table. */
  name?: string | null
  /** Coerced via {@link parseValidationStatus}; unknown values become `'pending'`. */
  validationStatus?: string | null
  validationError?: string | null
  /** Permission scopes returned by KSeF. Omit to leave the stored value untouched. */
  grantedPermissions?: string[] | undefined
}

/**
 * Creates or updates the certificate credential for (company, environment).
 *
 * Mirrors {@link upsertTokenCredential}, including the `validated_at` and
 * `grantedPermissions` semantics; the row's `token` column is explicitly
 * nulled on create so a credential is never both kinds at once.
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

/**
 * Marks the credential as default when it is the company's only one.
 *
 * Keeps the "a company with credentials has exactly one default" invariant
 * without forcing the user to pick one after adding their first. A no-op when
 * other credentials already exist — the existing default is left alone.
 */
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

/**
 * Patch payload. Every field is optional; only those present are written, so
 * `undefined` means "leave alone" while an explicit `null` clears the column.
 * The secret columns (`token`, `encrypted_private_key`) are deliberately not
 * updatable here — replacing those goes through the upsert functions.
 */
export type CredentialUpdateInput = {
  name?: string | null
  validationStatus?: string
  validationError?: string | null
  validatedAt?: string | null
  /** `true` demotes the company's other credentials before promoting this one. */
  isDefault?: boolean
}

export type CredentialUpdateResult =
  /** Non-secret columns only — see the module note on not widening the select. */
  | { ok: true; credential: unknown }
  | { ok: false; reason: 'not_found' | 'no_fields' | 'db_error'; message: string }

/**
 * Partially updates a credential.
 *
 * Setting `isDefault: true` first clears the flag on the company's other
 * credentials, preserving the single-default invariant. The two writes are not
 * transactional: a failure between them can briefly leave the company with no
 * default, which the UI tolerates (no credential is pre-selected) and the next
 * successful update repairs.
 *
 * @returns `not_found` when the credential does not belong to `companyId`,
 *   `no_fields` when the payload had nothing to write.
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
 * Deletes a credential.
 *
 * If exactly one credential remains afterwards and it is not already the
 * default, it is promoted — otherwise deleting the default would leave the
 * company with credentials but nothing selected. With two or more remaining,
 * no promotion happens and the user picks explicitly.
 *
 * @returns `not_found` when the credential does not belong to `companyId`.
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
