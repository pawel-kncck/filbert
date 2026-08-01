import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database, Invoice } from '@/lib/types/database'
import type { CreateInvoiceInput } from '@/lib/validations/invoice'
import * as Sentry from '@sentry/nextjs'

const roundMoney = (value: number) => Math.round(value * 100) / 100

export type CreateInvoiceWithItemsResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; message: string }

/**
 * Creates a sales invoice with its item rows. The insert is not
 * transactional (no RPC yet): if item insertion fails, the invoice row
 * is deleted as compensation.
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

export type InvoiceFilters = {
  search?: string
  dateFrom?: string
  dateTo?: string
}

export type InvoiceQueryResult = {
  invoices: Invoice[]
  totalCount: number
  totalNet: number
  totalVat: number
  totalGross: number
}

export const PAGE_SIZE = 25

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
