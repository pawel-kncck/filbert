import type { Customer, Vendor } from './database'

/**
 * Customers (invoice buyers) and vendors (invoice sellers) are structurally
 * identical tables; "contact" is the shared abstraction over both.
 */
export type ContactEntity = 'customer' | 'vendor'

export type Contact = Customer

// Compile-time guarantee that the two rows stay interchangeable.
type _VendorIsContact = Vendor extends Contact ? true : never
type _ContactIsVendor = Contact extends Vendor ? true : never
const _rowParityCheck: [_VendorIsContact, _ContactIsVendor] = [true, true]
void _rowParityCheck
