import type { Vendor } from '@/lib/types/database'
import {
  getContacts,
  getContactById,
  getMissingContacts,
  getMissingContactsCount,
  CONTACTS_PAGE_SIZE,
  type ContactFilters,
  type MissingContact,
} from './contacts'

export type VendorFilters = ContactFilters

export type VendorQueryResult = {
  vendors: Vendor[]
  totalCount: number
}

export const VENDORS_PAGE_SIZE = CONTACTS_PAGE_SIZE

export async function getVendors(
  companyId: string,
  options: {
    page?: number
    filters?: VendorFilters
  } = {}
): Promise<VendorQueryResult> {
  const { contacts, totalCount } = await getContacts('vendor', companyId, options)
  return { vendors: contacts, totalCount }
}

export function getVendorById(vendorId: string, companyId: string): Promise<Vendor | null> {
  return getContactById('vendor', vendorId, companyId)
}

export type MissingVendor = MissingContact

export function getMissingVendorsCount(companyId: string): Promise<number> {
  return getMissingContactsCount('vendor', companyId)
}

export function getMissingVendors(companyId: string): Promise<MissingVendor[]> {
  return getMissingContacts('vendor', companyId)
}
