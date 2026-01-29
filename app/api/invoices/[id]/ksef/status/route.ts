import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMemberAuth, isApiError, apiError, unauthorized } from '@/lib/api/middleware'
import { getKsefCredentialsForCompany, updateInvoiceKsefStatus } from '@/lib/data/ksef'
import { KsefApiClient, KsefApiError } from '@/lib/ksef/api-client'
import * as Sentry from '@sentry/nextjs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()

  if (!invoice) {
    return apiError('NOT_FOUND', 'Invoice not found', 404)
  }

  const auth = await requireMemberAuth(invoice.company_id)
  if (isApiError(auth)) return auth

  if (!invoice.ksef_status || !['pending', 'sent'].includes(invoice.ksef_status)) {
    return apiError('BAD_REQUEST', 'Invoice does not have a pending KSeF submission', 400)
  }

  const credentials = await getKsefCredentialsForCompany(invoice.company_id)
  if (!credentials) {
    return apiError('BAD_REQUEST', 'KSeF credentials not configured', 400)
  }

  const { data: company } = await auth.supabase
    .from('companies')
    .select('nip')
    .eq('id', invoice.company_id)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  const client = new KsefApiClient(credentials.environment)

  try {
    await client.initSession(company.nip, credentials.token)

    const invoices = await client.fetchInvoices({
      subjectType: 'subject1',
      dateFrom: invoice.issue_date,
      dateTo: invoice.issue_date,
    })

    await client.terminateSession()

    const match = invoices.find((inv) => inv.invoiceNumber === invoice.invoice_number)

    if (match) {
      await updateInvoiceKsefStatus(invoice.id, {
        ksef_status: 'accepted',
        ksef_reference: match.ksefReferenceNumber,
        ksef_error: null,
      })

      return NextResponse.json({
        status: 'accepted',
        ksefReference: match.ksefReferenceNumber,
      })
    }

    return NextResponse.json({
      status: invoice.ksef_status,
      message: 'Invoice not yet processed by KSeF',
    })
  } catch (error) {
    Sentry.captureException(error)

    const errorMessage =
      error instanceof KsefApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error'

    return apiError('KSEF_ERROR', errorMessage, 500)
  }
}
