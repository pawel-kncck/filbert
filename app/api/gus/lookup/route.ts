import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { lookupNip, GusApiError } from '@/lib/gus'
import type { GusEnvironment } from '@/lib/gus'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const nip = request.nextUrl.searchParams.get('nip')
  if (!nip) {
    return NextResponse.json(
      { error: { code: 'INVALID_NIP', message: 'NIP parameter is required' } },
      { status: 400 }
    )
  }

  const cleanNip = nip.replace(/[-\s]/g, '')
  if (!/^\d{10}$/.test(cleanNip)) {
    return NextResponse.json(
      { error: { code: 'INVALID_NIP', message: 'NIP must be exactly 10 digits' } },
      { status: 400 }
    )
  }

  const rateCheck = checkRateLimit(`gus:${user.id}`, 10, 60 * 1000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      { status: 429 }
    )
  }

  const apiKey = process.env.GUS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'API_ERROR', message: 'GUS API not configured' } },
      { status: 503 }
    )
  }

  const environment = (process.env.GUS_ENVIRONMENT || 'test') as GusEnvironment

  try {
    const result = await lookupNip(cleanNip, apiKey, environment)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof GusApiError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        INVALID_NIP: 400,
        RATE_LIMITED: 429,
        AUTH_FAILED: 503,
        SESSION_FAILED: 503,
        CONNECTION_ERROR: 503,
        PARSE_ERROR: 502,
        API_ERROR: 502,
      }

      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusMap[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: { code: 'API_ERROR', message: 'Unexpected error during GUS lookup' } },
      { status: 500 }
    )
  }
}
