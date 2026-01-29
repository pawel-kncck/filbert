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
    Sentry.captureException(error)
    return null
  }

  return data
}

export async function getKsefCredentials(companyId: string): Promise<KsefCredentials | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_ksef_credentials')
    .select('company_id, token, environment, created_at, updated_at')
    .eq('company_id', companyId)
    .single()

  if (error) {
    // PGRST116 = no rows found, which is expected when no credentials exist
    if (error.code !== 'PGRST116') {
      Sentry.captureException(error)
    }
    return null
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
