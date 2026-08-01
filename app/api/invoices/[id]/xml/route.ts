import { NextRequest, NextResponse } from 'next/server'
import { requireInvoiceAccess, isApiError, apiError } from '@/lib/api/middleware'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await requireInvoiceAccess(id)
  if (isApiError(auth)) return auth

  const { invoice } = auth

  if (!invoice.ksef_xml) {
    return apiError('NOT_FOUND', 'No XML available for this invoice', 404)
  }

  return new NextResponse(invoice.ksef_xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `inline; filename="${invoice.ksef_reference || invoice.invoice_number}.xml"`,
    },
  })
}
