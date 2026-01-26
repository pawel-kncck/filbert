import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { locales, defaultLocale, localeCookieName, type Locale } from '@/lib/i18n/config'

// Get locale from path prefix
function getLocaleFromPath(pathname: string): Locale | null {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale
    }
  }
  return null
}

// Get preferred locale from request
function getPreferredLocale(request: NextRequest): Locale {
  // Check cookie first
  const cookieLocale = request.cookies.get(localeCookieName)?.value as Locale | undefined
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2))
      .find((lang) => locales.includes(lang as Locale)) as Locale | undefined

    if (preferredLocale) {
      return preferredLocale
    }
  }

  return defaultLocale
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle landing page locale prefix routing
  const isLocaleRoute = pathname === '/' || locales.some((locale) => pathname === `/${locale}`)

  if (isLocaleRoute) {
    const pathLocale = getLocaleFromPath(pathname)

    // If accessing root without locale prefix, redirect based on preference
    if (pathname === '/') {
      const preferredLocale = getPreferredLocale(request)

      // If preferred locale is not default, redirect to prefixed path
      if (preferredLocale !== defaultLocale) {
        return NextResponse.redirect(new URL(`/${preferredLocale}`, request.url))
      }
    }

    // Set locale cookie based on path
    const response = await updateSession(request)
    const localeToSet = pathLocale || defaultLocale
    response.cookies.set(localeCookieName, localeToSet, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })
    return response
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
