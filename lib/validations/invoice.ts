import { z } from 'zod'
import { fa3ItemSchema, fa3InvoiceBaseSchema } from './ksef-fa3'

export const invoiceItemSchema = fa3ItemSchema

export const createInvoiceSchema = fa3InvoiceBaseSchema.extend({
  company_id: z.string().uuid(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>
