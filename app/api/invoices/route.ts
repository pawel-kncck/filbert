import { NextRequest, NextResponse } from 'next/server'
import { requireMemberAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'
import { createInvoiceSchema } from '@/lib/validations/invoice'
import { createInvoiceWithItems } from '@/lib/data/invoices'
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

  // Get company info for vendor fields
  const { data: company } = await auth.supabase
    .from('companies')
    .select('name, nip')
    .eq('id', company_id)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  const result = await createInvoiceWithItems(auth.supabase, parsed.data, company)

  if (!result.ok) {
    return apiError('INTERNAL_ERROR', result.message, 500)
  }

  return NextResponse.json({ success: true, invoice: result.invoice })
}
