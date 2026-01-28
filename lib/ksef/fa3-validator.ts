import { fa3InvoiceSchema } from '@/lib/validations/ksef-fa3'

export type FA3ValidationError = {
  field: string
  messageKey: string
}

export type FA3ValidationResult = {
  valid: boolean
  errors: FA3ValidationError[]
}

/**
 * Validates invoice data against KSeF FA(3) schema.
 * Returns field-level errors with translation message keys.
 *
 * Field paths use dot notation:
 * - "invoiceNumber", "issueDate", "customerName", "customerNip"
 * - "items.0.description", "items.0.quantity", etc.
 * - "items" for invoice-level totals issues
 */
export function validateFA3(data: {
  invoice_number: string
  issue_date: string
  customer_name: string
  customer_nip: string | null
  currency: string
  items: {
    description: string
    quantity: number
    unit: string
    unit_price: number
    vat_rate: number
    net_amount: number
    vat_amount: number
    gross_amount: number
  }[]
}): FA3ValidationResult {
  const result = fa3InvoiceSchema.safeParse(data)

  if (result.success) {
    return { valid: true, errors: [] }
  }

  const errors: FA3ValidationError[] = result.error.issues.map((issue) => {
    const path = issue.path
    const field = mapPathToField(path)
    const messageKey =
      typeof issue.message === 'string' && issue.message.startsWith('fa3.')
        ? issue.message
        : mapZodCodeToKey(issue, path)

    return { field, messageKey }
  })

  return { valid: false, errors }
}

function mapPathToField(path: PropertyKey[]): string {
  if (path.length === 0) return 'general'

  // Top-level fields
  const fieldMap: Record<string, string> = {
    invoice_number: 'invoiceNumber',
    issue_date: 'issueDate',
    customer_name: 'customerName',
    customer_nip: 'customerNip',
    currency: 'currency',
    items: 'items',
  }

  const first = String(path[0])

  if (first === 'items' && path.length >= 3) {
    const index = path[1]
    const itemField = String(path[2])
    return `items.${String(index)}.${itemField}`
  }

  return fieldMap[first] || first
}

function mapZodCodeToKey(issue: { code: string; message: string }, path: PropertyKey[]): string {
  // For items array issues
  if (path.length > 0 && path[0] === 'items' && path.length >= 3) {
    const itemField = String(path[path.length - 1])
    switch (itemField) {
      case 'description':
        return 'fa3.item.descriptionRequired'
      case 'quantity':
        return 'fa3.item.quantityPositive'
      case 'unit':
        return 'fa3.item.unitRequired'
      case 'unit_price':
        return 'fa3.item.unitPriceNonNegative'
      case 'vat_rate':
        return 'fa3.item.invalidVatRate'
      case 'net_amount':
        return 'fa3.item.netMismatch'
      case 'vat_amount':
        return 'fa3.item.vatMismatch'
    }
  }

  // Generic fallback using message
  return issue.message || 'fa3.generic'
}
