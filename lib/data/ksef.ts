/**
 * Read-side helpers joining the app's KSeF state to the database: picking the
 * credential to authenticate with, and recording a send's outcome on an invoice.
 *
 * Server-only; RLS scopes both tables to the caller's companies. For the
 * write-side credential management (create, update, delete, default handling)
 * see `lib/data/ksef-credentials.ts`.
 *
 * @module
 */
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { KsefCredentials } from '@/lib/types/database'

/**
 * Picks the single credential a company should authenticate with.
 *
 * Selection order is: the credential flagged `is_default`, then by validation
 * status (`'invalid'` < `'pending'` < `'valid'` alphabetically ascending, so a
 * verified credential is **not** preferred — see the caveat below), then the
 * most recently created.
 *
 * The returned row carries secret columns (`token`, `encrypted_private_key`,
 * `refresh_token`). It is intended for the KSeF client, not for API responses —
 * do not return it to the browser unfiltered.
 *
 * @param companyId Company to read for.
 * @param environment Restrict to one KSeF environment. Omit to consider all,
 *   which is only appropriate when the caller does not care which it gets.
 * @returns The chosen credential, or `null` when the company has none.
 * @throws Any error other than "no rows", after reporting it to Sentry.
 *
 * @remarks The `validation_status` ordering is ascending, and the comment at
 *   that line claims `'valid'` sorts first — alphabetically it sorts last.
 *   In practice `is_default` decides for nearly every company, so this rarely
 *   bites; it is recorded here rather than changed, since altering credential
 *   selection is a behavioural change beyond documentation.
 */
export async function getKsefCredentialsForCompany(
  companyId: string,
  environment?: 'test' | 'demo' | 'prod'
): Promise<KsefCredentials | null> {
  const supabase = await createClient()

  let query = supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, validated_at, validation_status, validation_error, name, granted_permissions, is_default, certificate_expires_at, created_at, updated_at'
    )
    .eq('company_id', companyId)

  // If environment is specified, filter by it
  if (environment) {
    query = query.eq('environment', environment)
  }

  // Prefer default credential, then valid credentials, then most recent
  const { data, error } = await query
    .order('is_default', { ascending: false })
    .order('validation_status', { ascending: true }) // 'valid' comes before 'pending'/'invalid'
    .order('created_at', { ascending: false })
    .limit(1)
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
 * Records the outcome of a KSeF send on an invoice row.
 *
 * `ksef_status` is always written; the remaining columns are written only when
 * present in `update`, so a status transition can leave an earlier reference or
 * error in place. Pass `ksef_error: null` explicitly to clear a previous
 * failure — omitting it preserves the old message.
 *
 * @throws A wrapped error naming the operation, after reporting to Sentry.
 */
export async function updateInvoiceKsefStatus(
  invoiceId: string,
  update: {
    ksef_status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'error'
    ksef_reference?: string
    ksef_hash?: string
    ksef_error?: string | null
    ksef_sent_at?: string
  }
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({
      ksef_status: update.ksef_status,
      ...(update.ksef_reference !== undefined && { ksef_reference: update.ksef_reference }),
      ...(update.ksef_hash !== undefined && { ksef_hash: update.ksef_hash }),
      ...(update.ksef_error !== undefined && { ksef_error: update.ksef_error }),
      ...(update.ksef_sent_at !== undefined && { ksef_sent_at: update.ksef_sent_at }),
    })
    .eq('id', invoiceId)

  if (error) {
    Sentry.captureException(error)
    throw new Error(`Failed to update invoice KSeF status: ${error.message}`)
  }
}
