import { makeContactUpdateHandler, makeContactDeleteHandler } from '@/lib/api/contact-handlers'

export const PUT = makeContactUpdateHandler('vendor', 'vendorId')
export const DELETE = makeContactDeleteHandler('vendor', 'vendorId')
