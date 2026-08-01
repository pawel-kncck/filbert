import { NextRequest, NextResponse } from 'next/server'
import { requireInvoiceAccess, isApiError, apiError, toErrorMessage } from '@/lib/api/middleware'
import { getKsefCredentialsForCompany } from '@/lib/data/ksef'
import { KsefApiError } from '@/lib/ksef/api-client'
import { sendInvoiceToKsef } from '@/lib/ksef/send-invoice'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await requireInvoiceAccess(id)
  if (isApiError(auth)) return auth

  const { invoice } = auth

  // Validate invoice is eligible for sending
  if (invoice.type !== 'sales') {
    return apiError('BAD_REQUEST', 'Only sales invoices can be sent to KSeF', 400)
  }

  if (invoice.ksef_reference) {
    return apiError('BAD_REQUEST', 'Invoice already has a KSeF reference', 400)
  }

  if (invoice.ksef_status === 'pending') {
    return apiError('BAD_REQUEST', 'Invoice is already being sent to KSeF', 400)
  }

  const credentials = await getKsefCredentialsForCompany(invoice.company_id)
  if (!credentials) {
    return apiError('BAD_REQUEST', 'KSeF credentials not configured', 400)
  }

  const { data: company } = await auth.supabase
    .from('companies')
    .select('name, nip')
    .eq('id', invoice.company_id)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  const { data: items } = await auth.supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('position', { ascending: true })

  if (!items || items.length === 0) {
    return apiError('BAD_REQUEST', 'Invoice has no items', 400)
  }

  try {
    const result = await sendInvoiceToKsef({ invoice, items, credentials, nip: company.nip })

    if (result.status === 'accepted') {
      return NextResponse.json({ success: true, ksefReference: result.ksefReference })
    }

    return NextResponse.json({
      success: true,
      status: 'sent',
      message: 'Invoice sent, awaiting KSeF confirmation',
    })
  } catch (error) {
    Sentry.captureException(error)

    const code = error instanceof KsefApiError ? error.code : 'KSEF_ERROR'
    return apiError(code, toErrorMessage(error), 500)
  }
}
