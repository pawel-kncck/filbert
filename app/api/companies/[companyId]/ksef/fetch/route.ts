import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'
import { getKsefCredentialsForCompany } from '@/lib/data/ksef'
import { KsefApiError, KsefAuthError } from '@/lib/ksef/api-client'
import { authenticateKsefClient } from '@/lib/ksef/authenticate-client'
import { parseFA3Xml } from '@/lib/ksef/fa3-xml-parser'
import * as Sentry from '@sentry/nextjs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const body = await request.json()
  const { type, dateFrom, dateTo } = body

  if (!type || !['sales', 'purchase'].includes(type)) {
    return badRequest('Type must be "sales" or "purchase"')
  }

  if (!dateFrom || !dateTo) {
    return badRequest('dateFrom and dateTo are required')
  }

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const credentials = await getKsefCredentialsForCompany(companyId)
  if (!credentials) {
    return apiError('BAD_REQUEST', 'KSeF credentials not configured', 400)
  }

  const { data: company } = await auth.supabase
    .from('companies')
    .select('name, nip')
    .eq('id', companyId)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  try {
    const client = await authenticateKsefClient(credentials, company.nip)

    // subject1 = seller (our company issued), subject2 = buyer (received by us)
    const subjectType = type === 'sales' ? 'subject1' : 'subject2'
    const invoiceRefs = await client.fetchInvoices({
      subjectType,
      dateFrom,
      dateTo,
    })

    let imported = 0
    let skipped = 0

    for (const ref of invoiceRefs) {
      // Check if invoice already exists by ksef_reference
      const { data: existing } = await auth.supabase
        .from('invoices')
        .select('id')
        .eq('company_id', companyId)
        .eq('ksef_reference', ref.ksefReferenceNumber)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      // Download full invoice XML
      let xmlContent: string
      try {
        xmlContent = await client.getInvoice(ref.ksefReferenceNumber)
      } catch {
        Sentry.captureMessage(`Failed to download KSeF invoice: ${ref.ksefReferenceNumber}`)
        skipped++
        continue
      }

      // Parse XML
      let parsed
      try {
        parsed = parseFA3Xml(xmlContent)
      } catch {
        Sentry.captureMessage(`Failed to parse KSeF invoice XML: ${ref.ksefReferenceNumber}`)
        skipped++
        continue
      }

      // Determine vendor/customer based on type
      const invoiceData = {
        company_id: companyId,
        type: type as 'sales' | 'purchase',
        invoice_number: parsed.invoiceNumber,
        issue_date: parsed.issueDate,
        vendor_name: type === 'sales' ? company.name : parsed.vendorName,
        vendor_nip: type === 'sales' ? company.nip : parsed.vendorNip,
        customer_name: type === 'sales' ? parsed.customerName : company.name,
        customer_nip: type === 'sales' ? parsed.customerNip : company.nip,
        net_amount: parsed.netAmount,
        vat_amount: parsed.vatAmount,
        gross_amount: parsed.grossAmount,
        currency: parsed.currency,
        ksef_reference: ref.ksefReferenceNumber,
        ksef_status: 'accepted' as const,
        source: 'ksef' as const,
        ksef_xml: xmlContent,
      }

      const { data: invoice, error: invoiceError } = await auth.supabase
        .from('invoices')
        .insert(invoiceData)
        .select('id')
        .single()

      if (invoiceError) {
        Sentry.captureException(invoiceError)
        skipped++
        continue
      }

      // Insert items
      if (parsed.items.length > 0) {
        const itemRows = parsed.items.map((item) => ({
          invoice_id: invoice.id,
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          vat_rate: item.vatRate,
          net_amount: item.netAmount,
          vat_amount: item.vatAmount,
          gross_amount: item.grossAmount,
        }))

        const { error: itemsError } = await auth.supabase.from('invoice_items').insert(itemRows)

        if (itemsError) {
          Sentry.captureException(itemsError)
          // Invoice was created but items failed — don't count as skipped, it's partially imported
        }
      }

      imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: invoiceRefs.length,
    })
  } catch (error) {
    console.error('[KSeF Fetch] Full error:', error)
    console.error('[KSeF Fetch] Error name:', error instanceof Error ? error.name : 'unknown')
    console.error(
      '[KSeF Fetch] Error message:',
      error instanceof Error ? error.message : String(error)
    )
    if (error instanceof Error && error.stack) {
      console.error('[KSeF Fetch] Stack:', error.stack)
    }

    Sentry.captureException(error)

    const errorMessage =
      error instanceof KsefApiError || error instanceof KsefAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error'

    const errorCode =
      error instanceof KsefAuthError
        ? 'KSEF_AUTH_ERROR'
        : error instanceof KsefApiError
          ? 'KSEF_API_ERROR'
          : 'KSEF_ERROR'

    return apiError(errorCode, errorMessage, 500)
  }
}
