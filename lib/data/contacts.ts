/**
 * Reads for the two contact directories, customers and vendors.
 *
 * The `customers` and `vendors` tables are structurally identical, so every
 * function here is parameterized by {@link ContactEntity} rather than
 * duplicated. `lib/data/customers.ts` and `lib/data/vendors.ts` are thin
 * entity-bound wrappers over these.
 *
 * Server-only; RLS scopes both tables to the caller's companies, so the
 * `companyId` arguments narrow within what the caller may already see. Read
 * failures go to Sentry and are rethrown.
 *
 * @module
 */
import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactEntity } from '@/lib/types/contacts'
import * as Sentry from '@sentry/nextjs'

/** Maps the entity discriminator to its physical table name. */
export const CONTACT_TABLES = {
  customer: 'customers',
  vendor: 'vendors',
} as const satisfies Record<ContactEntity, string>

/** Filter state for a contact list, mirrored in the page's URL params. */
export type ContactFilters = {
  /** Case-insensitive substring match on name or NIP. */
  search?: string
}

/** One page of contacts plus the total across all pages. */
export type ContactQueryResult = {
  /** The requested page only — at most {@link CONTACTS_PAGE_SIZE} rows. */
  contacts: Contact[]
  /** Rows matching the filters across all pages; use for the page count. */
  totalCount: number
}

/** Rows per page. Shared with the pagination UI so both agree on page count. */
export const CONTACTS_PAGE_SIZE = 25

/**
 * Fetches one page of contacts, ordered by name.
 *
 * @param entity Which directory to read — `'customer'` or `'vendor'`.
 * @param companyId Company to scope to. RLS still applies.
 * @param options.page 1-based page number; defaults to the first page.
 * @param options.filters Search filter applied before pagination.
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
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

/**
 * Fetches a single contact scoped to a company.
 *
 * @returns The contact, or `null` when no row matches — covering both "does not
 *   exist" and "not visible under RLS". Callers render a 404 for either.
 * @throws Any error other than "no rows", after reporting it to Sentry.
 */
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

/** A counterparty seen on an invoice that has no matching contact row yet. */
export type MissingContact = {
  name: string
  /** `null` when the invoice recorded no NIP for this counterparty. */
  nip: string | null
}

/**
 * Counts invoice counterparties that don't yet exist as contact rows, via the
 * `get_missing_{customers,vendors}_count` RPC.
 *
 * Drives the "N contacts can be synced" badge on the settings pages. The RPC
 * runs the comparison in Postgres rather than pulling every invoice client-side.
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
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

/**
 * Lists the invoice counterparties that have no contact row yet, via the
 * `get_missing_{customers,vendors}` RPC.
 *
 * The rows this returns are what the sync endpoint inserts. Unpaginated — the
 * caller needs the complete set to perform the sync.
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
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
