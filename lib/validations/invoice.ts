import { z } from 'zod'

export const invoiceItemSchema = z.object({
  description: z.string().min(1).max(256),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unit_price: z.number().min(0),
  vat_rate: z.number().min(0),
  net_amount: z.number(),
  vat_amount: z.number(),
  gross_amount: z.number(),
})

export const createInvoiceSchema = z.object({
  company_id: z.string().uuid(),
  invoice_number: z.string().min(1).max(256),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer_name: z.string().min(1).max(256),
  customer_nip: z
    .string()
    .regex(/^\d{10}$/)
    .nullable()
    .optional()
    .transform((val) => val || null),
  currency: z.enum(['PLN', 'EUR', 'USD']),
  items: z.array(invoiceItemSchema).min(1),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>
