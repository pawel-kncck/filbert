import type { ContactEntity } from '@/lib/types/contacts'

/**
 * Per-entity UI configuration for the shared contact components.
 * Translation keys are relative to the entity namespace (`customers` /
 * `vendors`), which have parallel structures in messages/*.json.
 */
export const CONTACT_UI = {
  customer: {
    namespace: 'customers',
    apiBase: '/api/customers',
    settingsPath: '/settings/customers',
    invoiceListPath: '/sales',
    addLabelKey: 'actions.addCustomer',
    editLabelKey: 'actions.editCustomer',
    deleteLabelKey: 'actions.deleteCustomer',
    // People icon
    emptyIconPath:
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  vendor: {
    namespace: 'vendors',
    apiBase: '/api/vendors',
    settingsPath: '/settings/vendors',
    invoiceListPath: '/purchases',
    addLabelKey: 'actions.addVendor',
    editLabelKey: 'actions.editVendor',
    deleteLabelKey: 'actions.deleteVendor',
    // Package icon
    emptyIconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
} as const satisfies Record<ContactEntity, unknown>
