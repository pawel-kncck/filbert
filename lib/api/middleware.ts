import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUserCompanyAdmin } from '@/lib/data/members'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

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

export function isApiError(result: unknown): result is NextResponse<ApiError> {
  return result instanceof NextResponse
}
