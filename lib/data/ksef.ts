import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { KsefCredentials } from '@/lib/types/database'

export async function getKsefCredentialsForCompany(
  companyId: string
): Promise<KsefCredentials | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, created_at, updated_at'
    )
    .eq('company_id', companyId)
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
