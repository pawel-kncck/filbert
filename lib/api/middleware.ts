import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUserCompanyAdmin, isUserCompanyMember } from '@/lib/data/members'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Invoice } from '@/lib/types/database'

export type ApiError = {
  error: {
    code: string
    message: string
  }
}

export function apiError(code: string, message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message } }, { status })
}

export function unauthorized(): NextResponse<ApiError> {
  return apiError('UNAUTHORIZED', 'Authentication required', 401)
}

export function forbidden(): NextResponse<ApiError> {
  return apiError('FORBIDDEN', 'Insufficient permissions', 403)
}

export function badRequest(message: string): NextResponse<ApiError> {
  return apiError('BAD_REQUEST', message, 400)
}

export type AdminContext = {
  user: { id: string; email?: string }
  supabase: SupabaseClient<Database>
  companyId: string
}

export async function requireAdminAuth(
  companyId: string | undefined | null
): Promise<AdminContext | NextResponse<ApiError>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  if (!companyId) {
    return badRequest('Company ID required')
  }

  const isAdmin = await isUserCompanyAdmin(user.id, companyId)
  if (!isAdmin) {
    return forbidden()
  }

  return { user, supabase, companyId }
}

export type MemberContext = {
  user: { id: string; email?: string }
  supabase: SupabaseClient<Database>
  companyId: string
}

export async function requireMemberAuth(
  companyId: string | undefined | null
): Promise<MemberContext | NextResponse<ApiError>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  if (!companyId) {
    return badRequest('Company ID required')
  }

  const isMember = await isUserCompanyMember(user.id, companyId)
  if (!isMember) {
    return forbidden()
  }

  return { user, supabase, companyId }
}

export type UserContext = {
  user: { id: string; email?: string }
  supabase: SupabaseClient<Database>
}

/**
 * Requires a signed-in user without any company-membership check.
 * Use for endpoints where row access is enforced purely by RLS.
 */
export async function requireUserAuth(): Promise<UserContext | NextResponse<ApiError>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  return { user, supabase }
}

export type InvoiceContext = MemberContext & { invoice: Invoice }

/**
 * Fetches an invoice (RLS-scoped) and requires membership in its company.
 * Returns 404 if the invoice doesn't exist or isn't visible to the user.
 */
export async function requireInvoiceAccess(
  invoiceId: string
): Promise<InvoiceContext | NextResponse<ApiError>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized()
  }

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()

  if (!invoice) {
    return apiError('NOT_FOUND', 'Invoice not found', 404)
  }

  const isMember = await isUserCompanyMember(user.id, invoice.company_id)
  if (!isMember) {
    return forbidden()
  }

  return { user, supabase, companyId: invoice.company_id, invoice }
}

export function isApiError(result: unknown): result is NextResponse<ApiError> {
  return result instanceof NextResponse
}

/**
 * Narrows an unknown thrown value to a human-readable message.
 */
export function toErrorMessage(error: unknown, fallback: string = 'Unknown error'): string {
  return error instanceof Error ? error.message : fallback
}
