import { NextRequest, NextResponse } from 'next/server'
import { requireMemberAuth, isApiError, apiError } from '@/lib/api/middleware'
import { getMissingCustomers } from '@/lib/data/customers'

export async function POST(request: NextRequest) {
  const { companyId } = await request.json()

  const auth = await requireMemberAuth(companyId)
  if (isApiError(auth)) return auth

  const missingCustomers = await getMissingCustomers(auth.companyId)

  if (missingCustomers.length === 0) {
    return NextResponse.json({ success: true, imported: 0 })
  }

  const customersToInsert = missingCustomers.map((c) => ({
    company_id: auth.companyId,
    name: c.name,
    nip: c.nip,
    is_synced: true,
  }))

  const { error, data } = await auth.supabase.from('customers').insert(customersToInsert).select()

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, imported: data?.length || 0 })
}
