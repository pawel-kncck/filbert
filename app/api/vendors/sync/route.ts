import { NextRequest, NextResponse } from 'next/server'
import { requireMemberAuth, isApiError, apiError } from '@/lib/api/middleware'
import { getMissingVendors } from '@/lib/data/vendors'

export async function POST(request: NextRequest) {
  const { companyId } = await request.json()

  const auth = await requireMemberAuth(companyId)
  if (isApiError(auth)) return auth

  const missingVendors = await getMissingVendors(auth.companyId)

  if (missingVendors.length === 0) {
    return NextResponse.json({ success: true, imported: 0 })
  }

  const vendorsToInsert = missingVendors.map((v) => ({
    company_id: auth.companyId,
    name: v.name,
    nip: v.nip,
    is_synced: true,
  }))

  const { error, data } = await auth.supabase.from('vendors').insert(vendorsToInsert).select()

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, imported: data?.length || 0 })
}
