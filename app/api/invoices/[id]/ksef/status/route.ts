import { NextRequest, NextResponse } from 'next/server'
import { requireInvoiceAccess, isApiError, apiError, toErrorMessage } from '@/lib/api/middleware'
import { getKsefCredentialsForCompany, updateInvoiceKsefStatus } from '@/lib/data/ksef'
import { authenticateKsefClient } from '@/lib/ksef/authenticate-client'
import * as Sentry from '@sentry/nextjs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await requireInvoiceAccess(id)
  if (isApiError(auth)) return auth

  const { invoice } = auth

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

  try {
    const client = await authenticateKsefClient(credentials, company.nip)

    const invoices = await client.fetchInvoices({
      subjectType: 'subject1',
      dateFrom: invoice.issue_date,
      dateTo: invoice.issue_date,
    })

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

    return apiError('KSEF_ERROR', toErrorMessage(error), 500)
  }
}
