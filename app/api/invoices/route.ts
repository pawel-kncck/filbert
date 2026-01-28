import { NextRequest, NextResponse } from 'next/server'
import { requireMemberAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'
import { createInvoiceSchema } from '@/lib/validations/invoice'
import { validateFA3 } from '@/lib/ksef/fa3-validator'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Basic schema validation
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return badRequest(firstIssue?.message || 'Invalid input')
  }

  const { company_id, invoice_number, issue_date, customer_name, customer_nip, currency, items } =
    parsed.data

  // FA(3) schema validation
  const fa3Result = validateFA3({
    invoice_number,
    issue_date,
    customer_name,
    customer_nip: customer_nip || null,
    currency,
    items,
  })

  if (!fa3Result.valid) {
    const messages = fa3Result.errors.map((e) => e.messageKey).join(', ')
    return apiError('FA3_VALIDATION', messages, 422)
  }

  const auth = await requireMemberAuth(company_id)
  if (isApiError(auth)) return auth

  // Compute totals from items
  const net_amount = items.reduce((sum, item) => sum + item.net_amount, 0)
  const vat_amount = items.reduce((sum, item) => sum + item.vat_amount, 0)
  const gross_amount = items.reduce((sum, item) => sum + item.gross_amount, 0)

  // Get company info for vendor fields
  const { data: company } = await auth.supabase
    .from('companies')
    .select('name, nip')
    .eq('id', company_id)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  // Insert invoice
  const { data: invoice, error: invoiceError } = await auth.supabase
    .from('invoices')
    .insert({
      company_id,
      type: 'sales',
      invoice_number: invoice_number.trim(),
      issue_date,
      vendor_name: company.name,
      vendor_nip: company.nip,
      customer_name: customer_name.trim(),
      customer_nip: customer_nip || null,
      net_amount: Math.round(net_amount * 100) / 100,
      vat_amount: Math.round(vat_amount * 100) / 100,
      gross_amount: Math.round(gross_amount * 100) / 100,
      currency,
      source: 'manual',
    })
    .select()
    .single()

  if (invoiceError) {
    return apiError('INTERNAL_ERROR', invoiceError.message, 500)
  }

  // Insert items
  const itemRows = items.map((item, index) => ({
    invoice_id: invoice.id,
    position: index + 1,
    description: item.description.trim(),
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
    net_amount: Math.round(item.net_amount * 100) / 100,
    vat_amount: Math.round(item.vat_amount * 100) / 100,
    gross_amount: Math.round(item.gross_amount * 100) / 100,
  }))

  const { error: itemsError } = await auth.supabase.from('invoice_items').insert(itemRows)

  if (itemsError) {
    // Clean up the invoice if items fail
    await auth.supabase.from('invoices').delete().eq('id', invoice.id)
    return apiError('INTERNAL_ERROR', itemsError.message, 500)
  }

  return NextResponse.json({ success: true, invoice })
}
