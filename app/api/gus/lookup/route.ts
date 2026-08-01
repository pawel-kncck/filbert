import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, isApiError, apiError } from '@/lib/api/middleware'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { lookupNip, GusApiError, GUS_ERROR_HTTP_STATUS } from '@/lib/gus'
import type { GusEnvironment } from '@/lib/gus'

export async function GET(request: NextRequest) {
  const auth = await requireUserAuth()
  if (isApiError(auth)) return auth

  const nip = request.nextUrl.searchParams.get('nip')
  if (!nip) {
    return apiError('INVALID_NIP', 'NIP parameter is required', 400)
  }

  const cleanNip = nip.replace(/[-\s]/g, '')
  if (!/^\d{10}$/.test(cleanNip)) {
    return apiError('INVALID_NIP', 'NIP must be exactly 10 digits', 400)
  }

  const rateCheck = checkRateLimit(`gus:${auth.user.id}`, 10, 60 * 1000)
  if (!rateCheck.allowed) {
    return apiError('RATE_LIMITED', 'Too many requests', 429)
  }

  const apiKey = process.env.GUS_API_KEY
  if (!apiKey) {
    return apiError('API_ERROR', 'GUS API not configured', 503)
  }

  const environment = (process.env.GUS_ENVIRONMENT || 'test') as GusEnvironment

  try {
    const result = await lookupNip(cleanNip, apiKey, environment)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof GusApiError) {
      return apiError(error.code, error.message, GUS_ERROR_HTTP_STATUS[error.code] || 500)
    }

    return apiError('API_ERROR', 'Unexpected error during GUS lookup', 500)
  }
}
