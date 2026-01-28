import { z } from 'zod'

/**
 * KSeF FA(3) schema validation rules for Polish e-invoices.
 *
 * FA(3) element mappings:
 * - P_2: invoice_number
 * - P_1: issue_date
 * - DaneIdentyfikacyjneSprzedawcy/Nazwa: vendor_name
 * - NrEwidencyjnyPodatnika: vendor_nip
 * - DaneIdentyfikacyjneNabywcy/Nazwa: customer_name
 * - NrNIP: customer_nip
 * - KodWaluty: currency
 * - P_7: item description
 * - P_8A: item quantity
 * - P_8B: item unit
 * - P_9A: item unit_price
 * - P_12: item vat_rate
 */

const ALLOWED_VAT_RATES = [23, 8, 5, 0]

export const fa3ItemSchema = z
  .object({
    description: z
      .string()
      .min(1, 'fa3.item.descriptionRequired')
      .max(256, 'fa3.item.descriptionMaxLength'),
    quantity: z.number().positive('fa3.item.quantityPositive'),
    unit: z.string().min(1, 'fa3.item.unitRequired'),
    unit_price: z.number().min(0, 'fa3.item.unitPriceNonNegative'),
    vat_rate: z.number().refine((val) => ALLOWED_VAT_RATES.includes(val), {
      message: 'fa3.item.invalidVatRate',
    }),
    net_amount: z.number(),
    vat_amount: z.number(),
    gross_amount: z.number(),
  })
  .superRefine((item, ctx) => {
    // P_11: net_amount must equal qty × unit_price (within rounding tolerance)
    const expectedNet = Math.round(item.quantity * item.unit_price * 100) / 100
    if (Math.abs(item.net_amount - expectedNet) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fa3.item.netMismatch',
        path: ['net_amount'],
      })
    }

    // P_11A: vat_amount must equal net × vat_rate% (within rounding tolerance)
    const expectedVat = Math.round(item.net_amount * (item.vat_rate / 100) * 100) / 100
    if (Math.abs(item.vat_amount - expectedVat) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fa3.item.vatMismatch',
        path: ['vat_amount'],
      })
    }
  })

export const fa3InvoiceSchema = z
  .object({
    invoice_number: z
      .string()
      .min(1, 'fa3.invoiceNumberRequired')
      .max(256, 'fa3.invoiceNumberMaxLength'),
    issue_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fa3.issueDateFormat')
      .refine(
        (val) => {
          const date = new Date(val + 'T00:00:00')
          const today = new Date()
          today.setHours(23, 59, 59, 999)
          return date <= today
        },
        { message: 'fa3.issueDateFuture' }
      ),
    customer_name: z
      .string()
      .min(1, 'fa3.customerNameRequired')
      .max(256, 'fa3.customerNameMaxLength'),
    customer_nip: z
      .string()
      .nullable()
      .optional()
      .refine(
        (val) => {
          if (!val) return true
          return /^\d{10}$/.test(val)
        },
        { message: 'fa3.invalidNip' }
      ),
    currency: z.enum(['PLN', 'EUR', 'USD'], {
      message: 'fa3.invalidCurrency',
    }),
    items: z.array(fa3ItemSchema).min(1, 'fa3.atLeastOneItem'),
  })
  .superRefine((invoice, ctx) => {
    const itemsNetSum = invoice.items.reduce((sum, item) => sum + item.net_amount, 0)
    const itemsVatSum = invoice.items.reduce((sum, item) => sum + item.vat_amount, 0)
    const itemsGrossSum = invoice.items.reduce((sum, item) => sum + item.gross_amount, 0)

    const roundedNet = Math.round(itemsNetSum * 100) / 100
    const roundedVat = Math.round(itemsVatSum * 100) / 100
    const roundedGross = Math.round(itemsGrossSum * 100) / 100

    // P_15: gross_amount must equal net + vat
    const expectedGross = Math.round((roundedNet + roundedVat) * 100) / 100
    if (Math.abs(roundedGross - expectedGross) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fa3.grossMismatch',
        path: ['items'],
      })
    }
  })

export type FA3InvoiceInput = z.infer<typeof fa3InvoiceSchema>
