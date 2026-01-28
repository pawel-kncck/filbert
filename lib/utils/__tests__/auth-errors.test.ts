import { describe, it, expect } from 'vitest'
import { getAuthErrorKey, translateAuthError } from '../auth-errors'

describe('getAuthErrorKey', () => {
  it('returns correct key for exact match', () => {
    expect(getAuthErrorKey('Invalid login credentials')).toBe('invalidCredentials')
    expect(getAuthErrorKey('Email not confirmed')).toBe('emailNotConfirmed')
    expect(getAuthErrorKey('User already registered')).toBe('userExists')
    expect(getAuthErrorKey('Email rate limit exceeded')).toBe('rateLimitExceeded')
    expect(getAuthErrorKey('Invalid email')).toBe('invalidEmail')
  })

  it('returns correct key for partial match', () => {
    expect(getAuthErrorKey('Password should be at least 12 characters')).toBe(
      'passwordRequirements'
    )
  })

  it('returns null for unknown error message', () => {
    expect(getAuthErrorKey('Something unexpected happened')).toBeNull()
    expect(getAuthErrorKey('')).toBeNull()
  })
})

describe('translateAuthError', () => {
  it('translates known error messages to Polish', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('Nieprawidłowy email lub hasło')
    expect(translateAuthError('Email not confirmed')).toContain('Email nie został potwierdzony')
  })

  it('returns partial match translation', () => {
    expect(translateAuthError('Password should be at least 12 characters')).toContain(
      'Hasło musi mieć'
    )
  })

  it('returns original message for unknown errors', () => {
    expect(translateAuthError('Unknown error')).toBe('Unknown error')
  })
})
