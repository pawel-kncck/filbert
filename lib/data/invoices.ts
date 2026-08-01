/**
 * Invoice reads and writes against the `invoices` / `invoice_items` tables.
 *
 * Server-only (see `lib/data/README` conventions): every function here either
 * calls `createClient()` from `@/lib/supabase/server`, which reads request
 * cookies, or takes a server client as its first argument. Importing from a
 * client component will fail at build time.
 *
 * **RLS.** `invoices` is row-level-secured to the companies the caller belongs
 * to, so the `companyId` arguments below are a narrowing filter rather than the
 * access control — a company the caller cannot see yields an empty result, not
 * another company's rows. Callers that need an explicit 403/404 should go
 * through `requireMemberAuth` / `requireInvoiceAccess` in `lib/api/middleware`.
 *
 * **Errors.** Read failures are reported to Sentry and rethrown, so callers see
 * a real exception rather than silently-empty data. `createInvoiceWithItems` is
 * the exception: it returns a result object, because its failures are usually
 * user-correctable (duplicate invoice number) and belong in a 400, not a 500.
 *
 * @module
 */
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database, Invoice } from '@/lib/types/database'
import type { CreateInvoiceInput } from '@/lib/validations/invoice'
import * as Sentry from '@sentry/nextjs'

/** Rounds to 2 decimal places — money is stored to the grosz. */
const roundMoney = (value: number) => Math.round(value * 100) / 100

/** Success carries the created row; failure carries a message fit for a 400. */
export type CreateInvoiceWithItemsResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; message: string }

/**
 * Creates a sales invoice together with its line items.
 *
 * Invoice-level `net_amount` / `vat_amount` / `gross_amount` are derived by
 * summing the items, not taken from the input, so the header always agrees with
 * the lines. Both levels are rounded to 2dp.
 *
 * **Not transactional.** Supabase's REST interface cannot span two inserts, and
 * there is no RPC for this yet, so a failed item insert is followed by a
 * compensating delete of the invoice row. That window is small but real: if the
 * process dies between the two writes, an invoice with no items survives.
 * Moving this into a Postgres function would close it.
 *
 * @param supabase Request-scoped server client — passed in rather than created
 *   here so the route's already-authenticated client is reused.
 * @param input Validated payload (see `createInvoiceSchema`).
 * @param vendor Issuing company's name and NIP, copied onto the invoice so it
 *   reflects the details as of issue time rather than following later edits.
 */
export async function createInvoiceWithItems(
  supabase: SupabaseClient<Database>,
  input: CreateInvoiceInput,
  vendor: { name: string; nip: string }
): Promise<CreateInvoiceWithItemsResult> {
  const { company_id, invoice_number, issue_date, customer_name, customer_nip, currency, items } =
    input

  const net_amount = items.reduce((sum, item) => sum + item.net_amount, 0)
  const vat_amount = items.reduce((sum, item) => sum + item.vat_amount, 0)
  const gross_amount = items.reduce((sum, item) => sum + item.gross_amount, 0)

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id,
      type: 'sales',
      invoice_number: invoice_number.trim(),
      issue_date,
      vendor_name: vendor.name,
      vendor_nip: vendor.nip,
      customer_name: customer_name.trim(),
      customer_nip: customer_nip || null,
      net_amount: roundMoney(net_amount),
      vat_amount: roundMoney(vat_amount),
      gross_amount: roundMoney(gross_amount),
      currency,
      source: 'manual',
    })
    .select()
    .single()

  if (invoiceError) {
    return { ok: false, message: invoiceError.message }
  }

  const itemRows = items.map((item, index) => ({
    invoice_id: invoice.id,
    position: index + 1,
    description: item.description.trim(),
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
    net_amount: roundMoney(item.net_amount),
    vat_amount: roundMoney(item.vat_amount),
    gross_amount: roundMoney(item.gross_amount),
  }))

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)

  if (itemsError) {
    // Compensating delete — keep the pair of writes all-or-nothing
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { ok: false, message: itemsError.message }
  }

  return { ok: true, invoice }
}

/** Filter state for the invoice list, mirrored in the page's URL params. */
export type InvoiceFilters = {
  /** Case-insensitive substring match on invoice number, vendor or customer name. */
  search?: string
  /** Inclusive lower bound on `issue_date` (ISO `YYYY-MM-DD`). */
  dateFrom?: string
  /** Inclusive upper bound on `issue_date` (ISO `YYYY-MM-DD`). */
  dateTo?: string
}

/** One page of invoices plus totals computed over the whole filtered set. */
export type InvoiceQueryResult = {
  /** The requested page only — at most {@link PAGE_SIZE} rows. */
  invoices: Invoice[]
  /** Rows matching the filters across all pages; use for the page count. */
  totalCount: number
  /** Sums over the entire filtered set, not just the returned page. */
  totalNet: number
  totalVat: number
  totalGross: number
}

/** Rows per page. Shared with the pagination UI so both agree on page count. */
export const PAGE_SIZE = 25

/**
 * Fetches one page of invoices plus totals for the full filtered set.
 *
 * Two queries are issued: a paginated one for the rows, and an unpaginated one
 * for the amounts, so the totals reflect every matching invoice rather than the
 * 25 on screen. The totals query fetches all matching amount columns and sums
 * them in JS — fine at current volumes, but worth moving to an aggregate RPC if
 * a company's invoice count grows large.
 *
 * @param companyId Company to scope to. RLS still applies (see the module note).
 * @param type `'sales'` or `'purchase'` — the two list pages.
 * @param options.page 1-based page number; defaults to the first page.
 * @param options.filters Search and date-range filters, applied to both queries.
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
export async function getInvoices(
  companyId: string,
  type: 'sales' | 'purchase',
  options: {
    page?: number
    filters?: InvoiceFilters
  } = {}
): Promise<InvoiceQueryResult> {
  const supabase = await createClient()
  const { page = 1, filters = {} } = options
  const offset = (page - 1) * PAGE_SIZE

  // Build query for invoices
  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', type)

  // Apply search filter
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(
      `invoice_number.ilike.${searchTerm},vendor_name.ilike.${searchTerm},customer_name.ilike.${searchTerm}`
    )
  }

  // Apply date filters
  if (filters.dateFrom) {
    query = query.gte('issue_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('issue_date', filters.dateTo)
  }

  // Order and paginate
  query = query.order('issue_date', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)

  const { data: invoices, error, count } = await query

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  // Build query for totals (with same filters but no pagination)
  let totalsQuery = supabase
    .from('invoices')
    .select('net_amount, vat_amount, gross_amount')
    .eq('company_id', companyId)
    .eq('type', type)

  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    totalsQuery = totalsQuery.or(
      `invoice_number.ilike.${searchTerm},vendor_name.ilike.${searchTerm},customer_name.ilike.${searchTerm}`
    )
  }
  if (filters.dateFrom) {
    totalsQuery = totalsQuery.gte('issue_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    totalsQuery = totalsQuery.lte('issue_date', filters.dateTo)
  }

  const { data: totals, error: totalsError } = await totalsQuery

  if (totalsError) {
    Sentry.captureException(totalsError)
    throw totalsError
  }

  const totalNet = (totals || []).reduce((sum, inv) => sum + Number(inv.net_amount), 0)
  const totalVat = (totals || []).reduce((sum, inv) => sum + Number(inv.vat_amount), 0)
  const totalGross = (totals || []).reduce((sum, inv) => sum + Number(inv.gross_amount), 0)

  return {
    invoices: invoices || [],
    totalCount: count || 0,
    totalNet,
    totalVat,
    totalGross,
  }
}

/**
 * Fetches a single invoice scoped to a company.
 *
 * @returns The invoice, or `null` when no row matches — which covers both
 *   "does not exist" and "not visible under RLS". Callers render a 404 for
 *   either; the two are deliberately indistinguishable.
 * @throws Any error other than "no rows", after reporting it to Sentry.
 */
export async function getInvoiceById(
  invoiceId: string,
  companyId: string
): Promise<Invoice | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
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

/**
 * Fetches every invoice matching the filters, bypassing pagination, for CSV
 * export.
 *
 * Deliberately unpaginated — the export must cover the user's whole filtered
 * selection, not the visible page. There is no upper bound on the row count, so
 * a company with a very large history will produce a correspondingly large
 * response; if that becomes a problem, stream or chunk rather than silently
 * capping, which would produce a quietly incomplete export.
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
export async function getAllInvoicesForExport(
  companyId: string,
  type: 'sales' | 'purchase',
  filters: InvoiceFilters = {}
): Promise<Invoice[]> {
  const supabase = await createClient()

  let query = supabase.from('invoices').select('*').eq('company_id', companyId).eq('type', type)

  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(
      `invoice_number.ilike.${searchTerm},vendor_name.ilike.${searchTerm},customer_name.ilike.${searchTerm}`
    )
  }
  if (filters.dateFrom) {
    query = query.gte('issue_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('issue_date', filters.dateTo)
  }

  query = query.order('issue_date', { ascending: false })

  const { data, error } = await query

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data || []
}
