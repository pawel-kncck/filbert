import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, isApiError, apiError } from '@/lib/api/middleware'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await requireUserAuth()
  if (isApiError(auth)) return auth

  // RLS ensures users can only access items for invoices they have access to
  const { data: items, error } = await auth.supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('position', { ascending: true })

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ items: items || [] })
}
