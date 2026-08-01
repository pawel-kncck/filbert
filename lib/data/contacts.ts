import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactEntity } from '@/lib/types/contacts'
import * as Sentry from '@sentry/nextjs'

export const CONTACT_TABLES = {
  customer: 'customers',
  vendor: 'vendors',
} as const satisfies Record<ContactEntity, string>

export type ContactFilters = {
  search?: string
}

export type ContactQueryResult = {
  contacts: Contact[]
  totalCount: number
}

export const CONTACTS_PAGE_SIZE = 25

export async function getContacts(
  entity: ContactEntity,
  companyId: string,
  options: {
    page?: number
    filters?: ContactFilters
  } = {}
): Promise<ContactQueryResult> {
  const supabase = await createClient()
  const { page = 1, filters = {} } = options
  const offset = (page - 1) * CONTACTS_PAGE_SIZE

  let query = supabase
    .from(CONTACT_TABLES[entity])
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)

  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(`name.ilike.${searchTerm},nip.ilike.${searchTerm}`)
  }

  query = query.order('name', { ascending: true }).range(offset, offset + CONTACTS_PAGE_SIZE - 1)

  const { data: contacts, error, count } = await query

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return {
    contacts: contacts || [],
    totalCount: count || 0,
  }
}

export async function getContactById(
  entity: ContactEntity,
  contactId: string,
  companyId: string
): Promise<Contact | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from(CONTACT_TABLES[entity])
    .select('*')
    .eq('id', contactId)
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

export type MissingContact = {
  name: string
  nip: string | null
}

/**
 * Counts invoice counterparties that don't yet exist as contact rows,
 * via the get_missing_{customers,vendors}_count RPC.
 */
export async function getMissingContactsCount(
  entity: ContactEntity,
  companyId: string
): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc(
    `get_missing_${CONTACT_TABLES[entity]}_count` as 'get_missing_customers_count',
    { p_company_id: companyId }
  )

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data ?? 0
}

export async function getMissingContacts(
  entity: ContactEntity,
  companyId: string
): Promise<MissingContact[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc(
    `get_missing_${CONTACT_TABLES[entity]}` as 'get_missing_customers',
    { p_company_id: companyId }
  )

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data ?? []
}
