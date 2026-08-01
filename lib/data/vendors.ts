/**
 * Vendor-facing wrappers over the shared contact helpers in `./contacts.ts`.
 *
 * `customers` and `vendors` are structurally identical, so the queries live in
 * one place and this module binds them to the `'vendor'` entity and renames
 * the result field for call sites. Behaviour — RLS scoping, pagination, error
 * handling — is documented on the underlying functions.
 *
 * @module
 */
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
