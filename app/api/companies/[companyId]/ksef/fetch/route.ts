import { NextRequest, NextResponse } from 'next/server'
import {
  requireAdminAuth,
  isApiError,
  apiError,
  badRequest,
  toErrorMessage,
} from '@/lib/api/middleware'
import { getKsefCredentialsForCompany } from '@/lib/data/ksef'
import { KsefApiError, KsefAuthError } from '@/lib/ksef/api-client'
import { authenticateKsefClient } from '@/lib/ksef/authenticate-client'
import { importKsefInvoices } from '@/lib/ksef/import-invoices'
import * as Sentry from '@sentry/nextjs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const body = await request.json()
  const { type, dateFrom, dateTo } = body

  if (!type || !['sales', 'purchase'].includes(type)) {
    return badRequest('Type must be "sales" or "purchase"')
  }

  if (!dateFrom || !dateTo) {
    return badRequest('dateFrom and dateTo are required')
  }

  const auth = await requireAdminAuth(companyId)
  if (isApiError(auth)) return auth

  const credentials = await getKsefCredentialsForCompany(companyId)
  if (!credentials) {
    return apiError('BAD_REQUEST', 'KSeF credentials not configured', 400)
  }

  const { data: company } = await auth.supabase
    .from('companies')
    .select('name, nip')
    .eq('id', companyId)
    .single()

  if (!company) {
    return apiError('NOT_FOUND', 'Company not found', 404)
  }

  try {
    const client = await authenticateKsefClient(credentials, company.nip)

    const result = await importKsefInvoices({
      supabase: auth.supabase,
      client,
      companyId,
      company,
      type: type as 'sales' | 'purchase',
      dateFrom,
      dateTo,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    Sentry.captureException(error)

    const errorCode =
      error instanceof KsefAuthError
        ? 'KSEF_AUTH_ERROR'
        : error instanceof KsefApiError
          ? 'KSEF_API_ERROR'
          : 'KSEF_ERROR'

    return apiError(errorCode, toErrorMessage(error), 500)
  }
}
