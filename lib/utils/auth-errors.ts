const errorTranslations: Record<string, string> = {
  'Invalid login credentials': 'Nieprawidłowy email lub hasło',
  'Email not confirmed': 'Email nie został potwierdzony. Sprawdź skrzynkę pocztową.',
  'User already registered': 'Użytkownik o tym adresie email już istnieje',
  'Password should be at least': 'Hasło musi mieć min. 12 znaków oraz zawierać: małą literę, wielką literę, cyfrę i znak specjalny',
  'Email rate limit exceeded': 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
  'Invalid email': 'Nieprawidłowy adres email',
}

export function translateAuthError(message: string): string {
  // Check for exact matches first
  if (errorTranslations[message]) {
    return errorTranslations[message]
  }

  // Check for partial matches (for messages that contain additional details)
  for (const [key, translation] of Object.entries(errorTranslations)) {
    if (message.includes(key)) {
      return translation
    }
  }

  // Return original message if no translation found
  return message
}
