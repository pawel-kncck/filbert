import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { KsefCredentials } from '@/lib/types/database'

export async function getKsefCredentialsForCompany(
  companyId: string,
  environment?: 'test' | 'demo' | 'prod'
): Promise<KsefCredentials | null> {
  const supabase = await createClient()

  let query = supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, validated_at, validation_status, validation_error, name, created_at, updated_at'
    )
    .eq('company_id', companyId)

  // If environment is specified, filter by it
  if (environment) {
    query = query.eq('environment', environment)
  }

  // Prefer valid credentials, then order by most recent
  const { data, error } = await query
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
