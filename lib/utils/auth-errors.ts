// Maps Supabase auth error messages to translation keys
const errorKeyMap: Record<string, string> = {
  'Invalid login credentials': 'invalidCredentials',
  'Email not confirmed': 'emailNotConfirmed',
  'User already registered': 'userExists',
  'Password should be at least': 'passwordRequirements',
  'Email rate limit exceeded': 'rateLimitExceeded',
  'Invalid email': 'invalidEmail',
}

export function getAuthErrorKey(message: string): string | null {
  // Check for exact matches first
  if (errorKeyMap[message]) {
    return errorKeyMap[message]
  }

  // Check for partial matches (for messages that contain additional details)
  for (const [key, translationKey] of Object.entries(errorKeyMap)) {
    if (message.includes(key)) {
      return translationKey
    }
  }

  // Return null if no translation key found
  return null
}

// Keep the old function for backwards compatibility during migration
// TODO: Remove this after all components are migrated to use getAuthErrorKey
export function translateAuthError(message: string): string {
  const errorTranslations: Record<string, string> = {
    'Invalid login credentials': 'Nieprawidłowy email lub hasło',
    'Email not confirmed': 'Email nie został potwierdzony. Sprawdź skrzynkę pocztową.',
    'User already registered': 'Użytkownik o tym adresie email już istnieje',
    'Password should be at least': 'Hasło musi mieć min. 12 znaków oraz zawierać: małą literę, wielką literę, cyfrę i znak specjalny',
    'Email rate limit exceeded': 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
    'Invalid email': 'Nieprawidłowy adres email',
  }

  if (errorTranslations[message]) {
    return errorTranslations[message]
  }

  for (const [key, translation] of Object.entries(errorTranslations)) {
    if (message.includes(key)) {
      return translation
    }
  }

  return message
}
