import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMemberAuth, isApiError, apiError, unauthorized } from '@/lib/api/middleware'
import { getKsefCredentialsForCompany, updateInvoiceKsefStatus } from '@/lib/data/ksef'
import { KsefApiClient, KsefApiError } from '@/lib/ksef/api-client'
import { buildFA3Xml } from '@/lib/ksef/fa3-xml-builder'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Authenticate user first
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  // Fetch invoice (RLS ensures user can only see their companies' invoices)
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()

  if (!invoice) {
    return apiError('NOT_FOUND', 'Invoice not found', 404)
  }

  // Verify membership
  const auth = await requireMemberAuth(invoice.company_id)
  if (isApiError(auth)) return auth

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

  // Get KSeF credentials
  const credentials = await getKsefCredentialsForCompany(invoice.company_id)
  if (!credentials) {
    return apiError('BAD_REQUEST', 'KSeF credentials not configured', 400)
  }

  // Get company info
  const { data: company } = await auth.supabase
    .from('companies')
    .select('name, nip')
    .eq('id', invoice.company_id)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  // Fetch invoice items
  const { data: items } = await auth.supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('position', { ascending: true })

  if (!items || items.length === 0) {
    return apiError('BAD_REQUEST', 'Invoice has no items', 400)
  }

  // Mark as pending
  await updateInvoiceKsefStatus(invoice.id, {
    ksef_status: 'pending',
    ksef_error: null,
    ksef_sent_at: new Date().toISOString(),
  })

  // Build XML
  const xml = buildFA3Xml({ invoice, items })

  // Send to KSeF
  const client = new KsefApiClient(credentials.environment)
  try {
    await client.initSession(company.nip, credentials.token)
    const result = await client.sendInvoice(xml)

    // Poll for status
    let status = await client.getInvoiceStatus(result.elementReferenceNumber)
    let attempts = 0
    const maxAttempts = 10

    while (!status.ksefReferenceNumber && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      status = await client.getInvoiceStatus(result.elementReferenceNumber)
      attempts++
    }

    await client.terminateSession()

    if (status.ksefReferenceNumber) {
      // Generate hash from XML for QR code
      const encoder = new TextEncoder()
      const xmlData = encoder.encode(xml)
      const hashBuffer = await crypto.subtle.digest('SHA-256', xmlData)
      const hashArray = new Uint8Array(hashBuffer)
      const hashBase64Url = btoa(String.fromCharCode(...hashArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')

      await updateInvoiceKsefStatus(invoice.id, {
        ksef_status: 'accepted',
        ksef_reference: status.ksefReferenceNumber,
        ksef_hash: hashBase64Url,
        ksef_error: null,
      })

      return NextResponse.json({
        success: true,
        ksefReference: status.ksefReferenceNumber,
      })
    } else {
      await updateInvoiceKsefStatus(invoice.id, {
        ksef_status: 'sent',
        ksef_error: null,
      })

      return NextResponse.json({
        success: true,
        status: 'sent',
        message: 'Invoice sent, awaiting KSeF confirmation',
      })
    }
  } catch (error) {
    const errorMessage =
      error instanceof KsefApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error'

    Sentry.captureException(error)

    await updateInvoiceKsefStatus(invoice.id, {
      ksef_status: 'error',
      ksef_error: errorMessage,
    })

    const code = error instanceof KsefApiError ? error.code : 'KSEF_ERROR'

    return apiError(code, errorMessage, 500)
  }
}
