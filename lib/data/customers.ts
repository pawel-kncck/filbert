import type { Customer } from '@/lib/types/database'
import {
  getContacts,
  getContactById,
  getMissingContacts,
  getMissingContactsCount,
  CONTACTS_PAGE_SIZE,
  type ContactFilters,
  type MissingContact,
} from './contacts'

export type CustomerFilters = ContactFilters

export type CustomerQueryResult = {
  customers: Customer[]
  totalCount: number
}

export const CUSTOMERS_PAGE_SIZE = CONTACTS_PAGE_SIZE

export async function getCustomers(
  companyId: string,
  options: {
    page?: number
    filters?: CustomerFilters
  } = {}
): Promise<CustomerQueryResult> {
  const { contacts, totalCount } = await getContacts('customer', companyId, options)
  return { customers: contacts, totalCount }
}

export function getCustomerById(customerId: string, companyId: string): Promise<Customer | null> {
  return getContactById('customer', customerId, companyId)
}

export type MissingCustomer = MissingContact

export function getMissingCustomersCount(companyId: string): Promise<number> {
  return getMissingContactsCount('customer', companyId)
}

export function getMissingCustomers(companyId: string): Promise<MissingCustomer[]> {
  return getMissingContacts('customer', companyId)
}
