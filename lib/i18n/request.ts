import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { defaultLocale, locales, localeCookieName, type Locale } from './config'

export default getRequestConfig(async () => {
  const locale = await getLocale()

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  }
})

export async function getLocale(): Promise<Locale> {
  // First, check cookie
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(localeCookieName)?.value as Locale | undefined

  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale
  }

  // Then, check Accept-Language header
  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')

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
