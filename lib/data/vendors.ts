import { createClient } from '@/lib/supabase/server'
import { Vendor } from '@/lib/types/database'
import * as Sentry from '@sentry/nextjs'

export type VendorFilters = {
  search?: string
}

export type VendorQueryResult = {
  vendors: Vendor[]
  totalCount: number
}

export const VENDORS_PAGE_SIZE = 25

export async function getVendors(
  companyId: string,
  options: {
    page?: number
    filters?: VendorFilters
  } = {}
): Promise<VendorQueryResult> {
  const supabase = await createClient()
  const { page = 1, filters = {} } = options
  const offset = (page - 1) * VENDORS_PAGE_SIZE

  let query = supabase.from('vendors').select('*', { count: 'exact' }).eq('company_id', companyId)

  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(`name.ilike.${searchTerm},nip.ilike.${searchTerm}`)
  }

  query = query.order('name', { ascending: true }).range(offset, offset + VENDORS_PAGE_SIZE - 1)

  const { data: vendors, error, count } = await query

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return {
    vendors: vendors || [],
    totalCount: count || 0,
  }
}

export async function getVendorById(vendorId: string, companyId: string): Promise<Vendor | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
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

export type MissingVendor = {
  name: string
  nip: string | null
}

export async function getMissingVendorsCount(companyId: string): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_missing_vendors_count', {
    p_company_id: companyId,
  })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data ?? 0
}

export async function getMissingVendors(companyId: string): Promise<MissingVendor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_missing_vendors', {
    p_company_id: companyId,
  })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data ?? []
}
