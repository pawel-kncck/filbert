/**
 * Line-item reads for a single invoice. Server-only.
 *
 * Items are written as part of {@link import('./invoices').createInvoiceWithItems}
 * rather than here.
 *
 * @module
 */
import { createClient } from '@/lib/supabase/server'
import { InvoiceItem } from '@/lib/types/database'
import * as Sentry from '@sentry/nextjs'

/**
 * Fetches an invoice's line items in display order (`position` ascending).
 *
 * Access rests entirely on RLS — `invoice_items` is scoped through its parent
 * invoice's company, so items of an invisible invoice come back as an empty
 * array. An empty result is therefore ambiguous between "no such invoice" and
 * "no items"; callers that need to tell them apart should resolve the invoice
 * first (e.g. via `requireInvoiceAccess`).
 *
 * Unpaginated: an invoice's item count is bounded in practice.
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return data || []
}
