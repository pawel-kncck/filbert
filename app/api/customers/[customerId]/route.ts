import { makeContactUpdateHandler, makeContactDeleteHandler } from '@/lib/api/contact-handlers'

export const PUT = makeContactUpdateHandler('customer', 'customerId')
export const DELETE = makeContactDeleteHandler('customer', 'customerId')
