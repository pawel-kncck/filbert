/**
 * Reads and mutations behind the company settings pages.
 *
 * Server-only; RLS scopes `companies` and `company_ksef_credentials` to the
 * caller. The mutations here return `{ error }` rather than throwing, because
 * their failures are shown inline in the settings form; the reads throw, since
 * a failed read means the page cannot render.
 *
 * The credential reads return rows containing secret columns (`token`,
 * `encrypted_private_key`, `refresh_token`) — components must project to
 * non-secret fields before rendering, and routes before responding.
 *
 * @module
 */
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { Company, KsefCredentials } from '@/lib/types/database'

/**
 * Fetches a company by id.
 *
 * @returns The company, or `null` when no row matches — covering both "does not
 *   exist" and "not visible under RLS".
 * @throws Any error other than "no rows", after reporting it to Sentry.
 */
export async function getCompanyById(companyId: string): Promise<Company | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, nip, is_demo, created_at')
    .eq('id', companyId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    Sentry.captureException(error)
    throw error
  }

  return data
}

/**
 * Lists every KSeF credential for a company, for the settings table.
 *
 * Ordered default-first, then by validation status, then newest — the same
 * ordering `getKsefCredentialsForCompany` uses to pick one, so the row the
 * client would authenticate with appears at the top. Unpaginated: a company
 * holds at most one credential per (environment, auth method).
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
export async function getKsefCredentials(companyId: string): Promise<KsefCredentials[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, validated_at, validation_status, validation_error, name, granted_permissions, is_default, certificate_expires_at, created_at, updated_at'
    )
    .eq('company_id', companyId)
    .order('is_default', { ascending: false })
    .order('validation_status', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data || []
}

/**
 * Fetches one KSeF credential by id.
 *
 * Note this does **not** take a `companyId` — access rests entirely on RLS, so
 * a credential belonging to another company reads as `null`. Callers that need
 * an explicit company check should use the `lib/data/ksef-credentials.ts`
 * helpers, which match on `company_id` as well.
 *
 * @returns The credential, or `null` when no row matches.
 * @throws Any error other than "no rows", after reporting it to Sentry.
 */
export async function getKsefCredential(credentialId: string): Promise<KsefCredentials | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, validated_at, validation_status, validation_error, name, granted_permissions, is_default, certificate_expires_at, created_at, updated_at'
    )
    .eq('id', credentialId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    Sentry.captureException(error)
    throw error
  }

  return data
}

/**
 * Renames a company.
 *
 * @returns `{}` on success, `{ error }` with the database message otherwise —
 *   the settings form renders it inline rather than failing the page.
 */
export async function updateCompanyName(
  companyId: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('companies').update({ name }).eq('id', companyId)

  if (error) {
    Sentry.captureException(error)
    return { error: error.message }
  }

  return {}
}

/**
 * Deletes a company.
 *
 * Destructive and admin-only (enforced by `requireAdminAuth` at the route and
 * by RLS). Dependent rows — invoices, items, contacts, memberships, KSeF
 * credentials — are removed by the schema's cascading foreign keys, so this is
 * not recoverable from the application.
 *
 * @returns `{}` on success, `{ error }` with the database message otherwise.
 */
export async function deleteCompany(companyId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('companies').delete().eq('id', companyId)

  if (error) {
    Sentry.captureException(error)
    return { error: error.message }
  }

  return {}
}
