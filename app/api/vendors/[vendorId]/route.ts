import { NextRequest, NextResponse } from 'next/server'
import {
  requireMemberAuth,
  requireAdminAuth,
  isApiError,
  apiError,
  badRequest,
} from '@/lib/api/middleware'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params
  const body = await request.json()
  const { companyId, name, nip, address, email, phone, notes } = body

  const auth = await requireMemberAuth(companyId)
  if (isApiError(auth)) return auth

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return badRequest('Vendor name cannot be empty')
  }

  // Validate NIP format if provided
  if (nip) {
    const cleanNip = nip.replace(/[-\s]/g, '')
    if (!/^\d{10}$/.test(cleanNip)) {
      return badRequest('Invalid NIP format')
    }
  }

  const cleanNip = nip ? nip.replace(/[-\s]/g, '') : nip === '' ? null : undefined

  // Check for duplicate NIP within company (exclude current vendor)
  if (cleanNip) {
    const { data: existing } = await auth.supabase
      .from('vendors')
      .select('id')
      .eq('company_id', auth.companyId)
      .eq('nip', cleanNip)
      .neq('id', vendorId)
      .maybeSingle()

    if (existing) {
      return apiError('DUPLICATE_NIP', 'A vendor with this NIP already exists', 409)
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name.trim()
  if (cleanNip !== undefined) updateData.nip = cleanNip
  if (address !== undefined) updateData.address = address?.trim() || null
  if (email !== undefined) updateData.email = email?.trim() || null
  if (phone !== undefined) updateData.phone = phone?.trim() || null
  if (notes !== undefined) updateData.notes = notes?.trim() || null

  const { data, error } = await auth.supabase
    .from('vendors')
    .update(updateData)
    .eq('id', vendorId)
    .eq('company_id', auth.companyId)
    .select()
    .single()

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true, vendor: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params
  const { companyId } = await request.json()

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const { error } = await auth.supabase
    .from('vendors')
    .delete()
    .eq('id', vendorId)
    .eq('company_id', auth.companyId)

  if (error) {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({ success: true })
}
