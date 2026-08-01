/**
 * Membership reads over `user_companies`.
 *
 * The two predicates here back the API guards in `lib/api/middleware.ts`, so
 * their semantics — in particular which roles count as a "member" — determine
 * what those guards allow. Server-only.
 *
 * @module
 */
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

/** A user's membership of one company. */
export type Member = {
  user_id: string
  role: 'admin' | 'member' | 'viewer'
  /** `'pending'` users await admin approval and are treated as having no access. */
  status: 'active' | 'pending'
  created_at: string
}

/**
 * Lists a company's memberships, oldest first, including pending ones so the
 * members page can offer approve/reject.
 *
 * @throws The underlying Postgres error, after reporting it to Sentry.
 */
export async function getCompanyMembers(companyId: string): Promise<Member[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_companies')
    .select('user_id, role, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    Sentry.captureException(error)
    throw error
  }

  return (data || []).map((m) => ({
    user_id: m.user_id,
    role: m.role as 'admin' | 'member' | 'viewer',
    status: m.status as 'active' | 'pending',
    created_at: m.created_at,
  }))
}

/**
 * Whether the user is an **active** `admin` of the company.
 *
 * Backs `requireAdminAuth`. Returns `false` rather than throwing on a query
 * error, so any failure to establish the role denies access.
 */
export async function isUserCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('user_companies')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single()

  return data?.role === 'admin'
}

/**
 * Whether the user may write to the company: an **active** `admin` or `member`.
 *
 * The `viewer` role returns `false`. Backs `requireMemberAuth` and
 * `requireInvoiceAccess`, so viewers are rejected by both — including on the
 * read-only invoice sub-routes those guard. Like {@link isUserCompanyAdmin},
 * a query error denies rather than throws.
 */
export async function isUserCompanyMember(userId: string, companyId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('user_companies')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single()

  return data?.role === 'admin' || data?.role === 'member'
}
