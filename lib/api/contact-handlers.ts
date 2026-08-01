import { NextRequest, NextResponse } from 'next/server'
import {
  requireMemberAuth,
  requireAdminAuth,
  isApiError,
  apiError,
  badRequest,
} from '@/lib/api/middleware'
import { normalizeNip, isValidNip } from '@/lib/validations/nip'
import { getMissingContacts, CONTACT_TABLES } from '@/lib/data/contacts'
import type { ContactEntity } from '@/lib/types/contacts'

/**
 * Shared route handlers for the structurally identical customers and
 * vendors APIs. Each factory binds an entity and returns a Next.js
 * route handler; responses keep the entity-specific payload key
 * (`{ customer: ... }` / `{ vendor: ... }`) for client compatibility.
 */

const LABELS: Record<ContactEntity, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
}

export function makeContactCreateHandler(entity: ContactEntity) {
  const table = CONTACT_TABLES[entity]
  const label = LABELS[entity]

  return async function POST(request: NextRequest) {
    const body = await request.json()
    const { companyId, name, nip, address, email, phone, notes } = body

    const auth = await requireMemberAuth(companyId)
    if (isApiError(auth)) return auth

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest(`${label} name is required`)
    }

    // Validate NIP format if provided (10 digits)
    if (nip && !isValidNip(nip)) {
      return badRequest('Invalid NIP format')
    }

    const cleanNip = nip ? normalizeNip(nip) : null

    // Check for duplicate NIP within company
    if (cleanNip) {
      const { data: existing } = await auth.supabase
        .from(table)
        .select('id')
        .eq('company_id', auth.companyId)
        .eq('nip', cleanNip)
        .maybeSingle()

      if (existing) {
        return apiError('DUPLICATE_NIP', `A ${entity} with this NIP already exists`, 409)
      }
    }

    const { data, error } = await auth.supabase
      .from(table)
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

    return NextResponse.json({ success: true, [entity]: data })
  }
}

export function makeContactUpdateHandler(entity: ContactEntity, idParam: string) {
  const table = CONTACT_TABLES[entity]
  const label = LABELS[entity]

  return async function PUT(
    request: NextRequest,
    { params }: { params: Promise<Record<string, string>> }
  ) {
    const contactId = (await params)[idParam]
    if (!contactId) return badRequest('Missing id')
    const body = await request.json()
    const { companyId, name, nip, address, email, phone, notes } = body

    const auth = await requireMemberAuth(companyId)
    if (isApiError(auth)) return auth

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return badRequest(`${label} name cannot be empty`)
    }

    // Validate NIP format if provided
    if (nip && !isValidNip(nip)) {
      return badRequest('Invalid NIP format')
    }

    const cleanNip = nip ? normalizeNip(nip) : nip === '' ? null : undefined

    // Check for duplicate NIP within company (exclude current row)
    if (cleanNip) {
      const { data: existing } = await auth.supabase
        .from(table)
        .select('id')
        .eq('company_id', auth.companyId)
        .eq('nip', cleanNip)
        .neq('id', contactId)
        .maybeSingle()

      if (existing) {
        return apiError('DUPLICATE_NIP', `A ${entity} with this NIP already exists`, 409)
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
      .from(table)
      .update(updateData)
      .eq('id', contactId)
      .eq('company_id', auth.companyId)
      .select()
      .single()

    if (error) {
      return apiError('INTERNAL_ERROR', error.message, 500)
    }

    return NextResponse.json({ success: true, [entity]: data })
  }
}

export function makeContactDeleteHandler(entity: ContactEntity, idParam: string) {
  const table = CONTACT_TABLES[entity]

  return async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<Record<string, string>> }
  ) {
    const contactId = (await params)[idParam]
    if (!contactId) return badRequest('Missing id')
    const { companyId } = await request.json()

    const auth = await requireAdminAuth(companyId)
    if (isApiError(auth)) return auth

    const { error } = await auth.supabase
      .from(table)
      .delete()
      .eq('id', contactId)
      .eq('company_id', auth.companyId)

    if (error) {
      return apiError('INTERNAL_ERROR', error.message, 500)
    }

    return NextResponse.json({ success: true })
  }
}

export function makeContactSyncHandler(entity: ContactEntity) {
  const table = CONTACT_TABLES[entity]

  return async function POST(request: NextRequest) {
    const { companyId } = await request.json()

    const auth = await requireMemberAuth(companyId)
    if (isApiError(auth)) return auth

    const missing = await getMissingContacts(entity, auth.companyId)

    if (missing.length === 0) {
      return NextResponse.json({ success: true, imported: 0 })
    }

    const rowsToInsert = missing.map((contact) => ({
      company_id: auth.companyId,
      name: contact.name,
      nip: contact.nip,
      is_synced: true,
    }))

    const { error, data } = await auth.supabase.from(table).insert(rowsToInsert).select()

    if (error) {
      return apiError('INTERNAL_ERROR', error.message, 500)
    }

    return NextResponse.json({ success: true, imported: data?.length || 0 })
  }
}
