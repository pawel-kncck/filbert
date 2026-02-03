import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('ksef_xml, ksef_reference, invoice_number')
    .eq('id', id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (!invoice.ksef_xml) {
    return NextResponse.json({ error: 'No XML available for this invoice' }, { status: 404 })
  }

  return new NextResponse(invoice.ksef_xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `inline; filename="${invoice.ksef_reference || invoice.invoice_number}.xml"`,
    },
  })
}
