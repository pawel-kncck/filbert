import { createClient } from '@/lib/supabase/server'
import { Invoice } from '@/lib/types/database'
import * as Sentry from '@sentry/nextjs'

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
