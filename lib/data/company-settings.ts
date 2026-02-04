import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { Company, KsefCredentials } from '@/lib/types/database'

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

export async function getKsefCredentials(companyId: string): Promise<KsefCredentials[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, validated_at, validation_status, validation_error, name, created_at, updated_at'
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data || []
}

export async function getKsefCredential(credentialId: string): Promise<KsefCredentials | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .select(
      'id, company_id, token, environment, auth_method, certificate_pem, encrypted_private_key, refresh_token, refresh_token_expires_at, validated_at, validation_status, validation_error, name, created_at, updated_at'
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

export async function deleteCompany(companyId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('companies').delete().eq('id', companyId)

  if (error) {
    Sentry.captureException(error)
    return { error: error.message }
  }

  return {}
}
