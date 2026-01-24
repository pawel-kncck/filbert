import { createClient } from '@/lib/supabase/server'
import { Invoice } from '@/lib/types/database'

export type InvoiceQueryResult = {
  invoices: Invoice[]
  totalCount: number
  totalNet: number
  totalVat: number
  totalGross: number
}

export async function getInvoices(
  companyId: string,
  type: 'sales' | 'purchase',
  options: {
    limit?: number
    offset?: number
  } = {}
): Promise<InvoiceQueryResult> {
  const supabase = await createClient()
  const { limit = 50, offset = 0 } = options

  // Get invoices
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', type)
    .order('issue_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching invoices:', error)
    return {
      invoices: [],
      totalCount: 0,
      totalNet: 0,
      totalVat: 0,
      totalGross: 0,
    }
  }

  // Calculate totals
  const { data: totals } = await supabase
    .from('invoices')
    .select('net_amount, vat_amount, gross_amount')
    .eq('company_id', companyId)
    .eq('type', type)

  const totalNet = (totals || []).reduce((sum, inv) => sum + Number(inv.net_amount), 0)
  const totalVat = (totals || []).reduce((sum, inv) => sum + Number(inv.vat_amount), 0)
  const totalGross = (totals || []).reduce((sum, inv) => sum + Number(inv.gross_amount), 0)

  return {
    invoices: invoices || [],
    totalCount: totals?.length || 0,
    totalNet,
    totalVat,
    totalGross,
  }
}
