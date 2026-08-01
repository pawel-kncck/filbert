/**
 * Shared auth guards and error shaping for API route handlers (`app/api/`).
 *
 * **Usage.** The `require*` guards return either a context object or a ready-to-
 * return `NextResponse` error. Route handlers branch with an `instanceof`
 * check (or {@link isApiError}) and return the response as-is:
 *
 * ```ts
 * const auth = await requireMemberAuth(companyId)
 * if (auth instanceof NextResponse) return auth
 * // auth.user / auth.supabase / auth.companyId are now available
 * ```
 *
 * **Relationship to RLS.** These guards are defence in depth, not the only
 * control. Every table has row-level security scoping rows to the companies the
 * caller belongs to, and the `supabase` client returned in each context is the
 * request-scoped (cookie-authenticated) client, so queries made through it stay
 * RLS-enforced. The guards exist to turn an implicit "empty result set" into an
 * explicit 401/403/404, and to enforce the role distinctions (admin vs member)
 * that RLS alone does not express at the route level.
 *
 * Server-only: importing this module from a client component will fail, because
 * `@/lib/supabase/server` reads request cookies.
 *
 * @module
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUserCompanyAdmin, isUserCompanyMember } from '@/lib/data/members'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Invoice } from '@/lib/types/database'

/** The error body shape every API route returns on failure. */
export type ApiError = {
  error: {
    code: string
    message: string
  }
}

/**
 * Builds the canonical `{ error: { code, message } }` JSON response.
 *
 * Prefer this (or the named helpers below) over an ad-hoc `NextResponse.json`
 * so clients can rely on a single error shape across all routes.
 *
 * @param code Stable machine-readable code, e.g. `'NOT_FOUND'`.
 * @param message Human-readable detail, safe to surface to the caller.
 * @param status HTTP status to send.
 */
export function apiError(code: string, message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** 401 — no authenticated user on the request. */
export function unauthorized(): NextResponse<ApiError> {
  return apiError('UNAUTHORIZED', 'Authentication required', 401)
}

/** 403 — authenticated, but lacking the required company role. */
export function forbidden(): NextResponse<ApiError> {
  return apiError('FORBIDDEN', 'Insufficient permissions', 403)
}

/** 400 — malformed or incomplete request. */
export function badRequest(message: string): NextResponse<ApiError> {
  return apiError('BAD_REQUEST', message, 400)
}

/** Context handed to a route handler once admin access has been established. */
export type AdminContext = {
  user: { id: string; email?: string }
  supabase: SupabaseClient<Database>
  companyId: string
}

/**
 * Requires a signed-in user with the `admin` role in `companyId`.
 *
 * Use for destructive or governance operations: managing members, editing
 * company-wide settings, storing KSeF credentials, deleting a company.
 *
 * @param companyId Target company. Accepts `undefined`/`null` so callers can
 *   pass an unvalidated query param straight through — a missing value yields
 *   400 rather than an unguarded query.
 * @returns The admin context, or a 401/400/403 response to return as-is.
 */
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

/** Context handed to a route handler once member access has been established. */
export type MemberContext = {
  user: { id: string; email?: string }
  supabase: SupabaseClient<Database>
  companyId: string
}

/**
 * Requires a signed-in user with the `admin` or `member` role in `companyId`.
 *
 * Note the `viewer` role does **not** satisfy this guard — `isUserCompanyMember`
 * accepts only `admin` and `member`, so read-only users receive 403. Use
 * {@link requireUserAuth} for endpoints that viewers should reach, and let RLS
 * scope the rows.
 *
 * @param companyId Target company; a missing value yields 400.
 * @returns The member context, or a 401/400/403 response to return as-is.
 */
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

/** Context handed to a route handler once a signed-in user has been established. */
export type UserContext = {
  user: { id: string; email?: string }
  supabase: SupabaseClient<Database>
}

/**
 * Requires a signed-in user without any company-membership check.
 *
 * Use for endpoints where row access is enforced purely by RLS — the returned
 * `supabase` client is request-scoped, so queries made through it already see
 * only rows belonging to the caller's companies. Also the right guard for
 * company-agnostic endpoints such as the GUS registry lookup.
 *
 * @returns The user context, or a 401 response to return as-is.
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

/** Member context plus the resolved invoice, so handlers need not refetch it. */
export type InvoiceContext = MemberContext & { invoice: Invoice }

/**
 * Resolves an invoice by id and requires membership in its owning company.
 *
 * Saves the four invoice sub-routes from repeating fetch → 404 → membership
 * check, and hands back the already-fetched row on the context.
 *
 * The fetch is RLS-scoped, so an invoice belonging to another company is
 * indistinguishable from one that does not exist — both yield 404, which is the
 * intended behaviour (a 403 would confirm the id is real). Like
 * {@link requireMemberAuth}, this rejects the `viewer` role.
 *
 * @param invoiceId Invoice primary key, typically the `[id]` route segment.
 * @returns The invoice context, or a 401/404/403 response to return as-is.
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

/**
 * Type guard distinguishing a guard's error response from its context.
 *
 * Equivalent to an inline `result instanceof NextResponse`; both spellings
 * appear in the route handlers.
 */
export function isApiError(result: unknown): result is NextResponse<ApiError> {
  return result instanceof NextResponse
}

/**
 * Narrows an unknown thrown value to a human-readable message.
 *
 * `catch` bindings are typed `unknown`, and this ladder was previously written
 * out at four call sites.
 *
 * @param error The caught value.
 * @param fallback Message to use when `error` is not an `Error`.
 */
export function toErrorMessage(error: unknown, fallback: string = 'Unknown error'): string {
  return error instanceof Error ? error.message : fallback
}
