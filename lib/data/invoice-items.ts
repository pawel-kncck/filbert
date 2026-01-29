import { createClient } from '@/lib/supabase/server'
import { InvoiceItem } from '@/lib/types/database'
import * as Sentry from '@sentry/nextjs'

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
