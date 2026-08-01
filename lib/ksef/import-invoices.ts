import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { KsefApiClient } from './api-client'
import { parseFA3Xml } from './fa3-xml-parser'
import * as Sentry from '@sentry/nextjs'

export type ImportInvoicesResult = {
  imported: number
  skipped: number
  total: number
}

/**
 * Imports invoices from KSeF for a date range: lists references, skips
 * ones already imported (by ksef_reference), downloads and parses the
 * FA(3) XML, and inserts invoice + item rows.
 *
 * Individual failures (download, parse, insert) are counted as skipped
 * and reported to Sentry; the import continues.
 */
export async function importKsefInvoices(params: {
  supabase: SupabaseClient<Database>
  client: KsefApiClient
  companyId: string
  company: { name: string; nip: string }
  type: 'sales' | 'purchase'
  dateFrom: string
  dateTo: string
}): Promise<ImportInvoicesResult> {
  const { supabase, client, companyId, company, type, dateFrom, dateTo } = params

  // subject1 = seller (our company issued), subject2 = buyer (received by us)
  const subjectType = type === 'sales' ? 'subject1' : 'subject2'
  const invoiceRefs = await client.fetchInvoices({ subjectType, dateFrom, dateTo })

  let imported = 0
  let skipped = 0

  for (const ref of invoiceRefs) {
    // Check if invoice already exists by ksef_reference
    const { data: existing } = await supabase
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

    // For sales invoices our company is the vendor; for purchases, the customer
    const invoiceData = {
      company_id: companyId,
      type,
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

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select('id')
      .single()

    if (invoiceError) {
      Sentry.captureException(invoiceError)
      skipped++
      continue
    }

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

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)

      if (itemsError) {
        Sentry.captureException(itemsError)
        // Invoice was created but items failed — don't count as skipped, it's partially imported
      }
    }

    imported++
  }

  return { imported, skipped, total: invoiceRefs.length }
}
