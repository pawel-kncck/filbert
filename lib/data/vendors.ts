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

  // Find distinct vendor_name/vendor_nip pairs from purchase invoices
  // that don't exist in the vendors table
  const { data: invoiceVendors, error: invoiceError } = await supabase
    .from('invoices')
    .select('vendor_name, vendor_nip')
    .eq('company_id', companyId)
    .eq('type', 'purchase')

  if (invoiceError) {
    Sentry.captureException(invoiceError)
    throw invoiceError
  }

  const { data: existingVendors, error: vendorError } = await supabase
    .from('vendors')
    .select('name, nip')
    .eq('company_id', companyId)

  if (vendorError) {
    Sentry.captureException(vendorError)
    throw vendorError
  }

  const existingSet = new Set((existingVendors || []).map((v) => `${v.name}||${v.nip || ''}`))

  const uniqueInvoiceVendors = new Set(
    (invoiceVendors || []).map((iv) => `${iv.vendor_name}||${iv.vendor_nip || ''}`)
  )

  let missingCount = 0
  for (const key of uniqueInvoiceVendors) {
    if (!existingSet.has(key)) {
      missingCount++
    }
  }

  return missingCount
}

export async function getMissingVendors(companyId: string): Promise<MissingVendor[]> {
  const supabase = await createClient()

  const { data: invoiceVendors, error: invoiceError } = await supabase
    .from('invoices')
    .select('vendor_name, vendor_nip')
    .eq('company_id', companyId)
    .eq('type', 'purchase')

  if (invoiceError) {
    Sentry.captureException(invoiceError)
    throw invoiceError
  }

  const { data: existingVendors, error: vendorError } = await supabase
    .from('vendors')
    .select('name, nip')
    .eq('company_id', companyId)

  if (vendorError) {
    Sentry.captureException(vendorError)
    throw vendorError
  }

  const existingSet = new Set((existingVendors || []).map((v) => `${v.name}||${v.nip || ''}`))

  const uniqueMap = new Map<string, MissingVendor>()
  for (const iv of invoiceVendors || []) {
    const key = `${iv.vendor_name}||${iv.vendor_nip || ''}`
    if (!existingSet.has(key) && !uniqueMap.has(key)) {
      uniqueMap.set(key, { name: iv.vendor_name, nip: iv.vendor_nip })
    }
  }

  return Array.from(uniqueMap.values())
}
