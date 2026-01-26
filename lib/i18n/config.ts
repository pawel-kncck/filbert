export const locales = ['pl', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'pl'

export const localeNames: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
}

export const localeCookieName = 'NEXT_LOCALE'
