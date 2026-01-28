import { createClient } from '@/lib/supabase/server'
import { Customer } from '@/lib/types/database'
import * as Sentry from '@sentry/nextjs'

export type CustomerFilters = {
  search?: string
}

export type CustomerQueryResult = {
  customers: Customer[]
  totalCount: number
}

export const CUSTOMERS_PAGE_SIZE = 25

export async function getCustomers(
  companyId: string,
  options: {
    page?: number
    filters?: CustomerFilters
  } = {}
): Promise<CustomerQueryResult> {
  const supabase = await createClient()
  const { page = 1, filters = {} } = options
  const offset = (page - 1) * CUSTOMERS_PAGE_SIZE

  let query = supabase.from('customers').select('*', { count: 'exact' }).eq('company_id', companyId)

  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(`name.ilike.${searchTerm},nip.ilike.${searchTerm}`)
  }

  query = query.order('name', { ascending: true }).range(offset, offset + CUSTOMERS_PAGE_SIZE - 1)

  const { data: customers, error, count } = await query

  if (error) {
    Sentry.captureException(error)
    return { customers: [], totalCount: 0 }
  }

  return {
    customers: customers || [],
    totalCount: count || 0,
  }
}

export async function getCustomerById(
  customerId: string,
  companyId: string
): Promise<Customer | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .single()

  if (error) {
    Sentry.captureException(error)
    return null
  }

  return data
}

export type MissingCustomer = {
  name: string
  nip: string | null
}

export async function getMissingCustomersCount(companyId: string): Promise<number> {
  const supabase = await createClient()

  // Find distinct customer_name/customer_nip pairs from sales invoices
  // that don't exist in the customers table
  const { data: invoiceCustomers, error: invoiceError } = await supabase
    .from('invoices')
    .select('customer_name, customer_nip')
    .eq('company_id', companyId)
    .eq('type', 'sales')

  if (invoiceError) {
    Sentry.captureException(invoiceError)
    return 0
  }

  const { data: existingCustomers, error: customerError } = await supabase
    .from('customers')
    .select('name, nip')
    .eq('company_id', companyId)

  if (customerError) {
    Sentry.captureException(customerError)
    return 0
  }

  const existingSet = new Set((existingCustomers || []).map((c) => `${c.name}||${c.nip || ''}`))

  const uniqueInvoiceCustomers = new Set(
    (invoiceCustomers || []).map((ic) => `${ic.customer_name}||${ic.customer_nip || ''}`)
  )

  let missingCount = 0
  for (const key of uniqueInvoiceCustomers) {
    if (!existingSet.has(key)) {
      missingCount++
    }
  }

  return missingCount
}

export async function getMissingCustomers(companyId: string): Promise<MissingCustomer[]> {
  const supabase = await createClient()

  const { data: invoiceCustomers, error: invoiceError } = await supabase
    .from('invoices')
    .select('customer_name, customer_nip')
    .eq('company_id', companyId)
    .eq('type', 'sales')

  if (invoiceError) {
    Sentry.captureException(invoiceError)
    return []
  }

  const { data: existingCustomers, error: customerError } = await supabase
    .from('customers')
    .select('name, nip')
    .eq('company_id', companyId)

  if (customerError) {
    Sentry.captureException(customerError)
    return []
  }

  const existingSet = new Set((existingCustomers || []).map((c) => `${c.name}||${c.nip || ''}`))

  const uniqueMap = new Map<string, MissingCustomer>()
  for (const ic of invoiceCustomers || []) {
    const key = `${ic.customer_name}||${ic.customer_nip || ''}`
    if (!existingSet.has(key) && !uniqueMap.has(key)) {
      uniqueMap.set(key, { name: ic.customer_name, nip: ic.customer_nip })
    }
  }

  return Array.from(uniqueMap.values())
}
