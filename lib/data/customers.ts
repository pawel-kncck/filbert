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
    throw error
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
    if (error.code === 'PGRST116') {
      return null
    }
    Sentry.captureException(error)
    throw error
  }

  return data
}

export type MissingCustomer = {
  name: string
  nip: string | null
}

export async function getMissingCustomersCount(companyId: string): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_missing_customers_count', {
    p_company_id: companyId,
  })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data ?? 0
}

export async function getMissingCustomers(companyId: string): Promise<MissingCustomer[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_missing_customers', {
    p_company_id: companyId,
  })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data ?? []
}
