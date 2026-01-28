import { NextRequest, NextResponse } from 'next/server'
import { requireMemberAuth, isApiError, apiError, badRequest } from '@/lib/api/middleware'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { companyId, name, nip, address, email, phone, notes } = body

  const auth = await requireMemberAuth(companyId)
  if (isApiError(auth)) return auth

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return badRequest('Vendor name is required')
  }

  // Validate NIP format if provided (10 digits)
  if (nip) {
    const cleanNip = nip.replace(/[-\s]/g, '')
    if (!/^\d{10}$/.test(cleanNip)) {
      return badRequest('Invalid NIP format')
    }
  }

  const cleanNip = nip ? nip.replace(/[-\s]/g, '') : null

  // Check for duplicate NIP within company
  if (cleanNip) {
    const { data: existing } = await auth.supabase
      .from('vendors')
      .select('id')
      .eq('company_id', auth.companyId)
      .eq('nip', cleanNip)
      .maybeSingle()

    if (existing) {
      return apiError('DUPLICATE_NIP', 'A vendor with this NIP already exists', 409)
    }
  }

  const { data, error } = await auth.supabase
    .from('vendors')
    .insert({
      company_id: auth.companyId,
      name: name.trim(),
      nip: cleanNip,
      address: address?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, vendor: data })
}
