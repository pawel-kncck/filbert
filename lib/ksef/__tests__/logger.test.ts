import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { describeSecret, isKsefDebugEnabled, ksefDebug, redactHeaders } from '../logger'

const ORIGINAL_DEBUG = process.env.KSEF_DEBUG

afterEach(() => {
  process.env.KSEF_DEBUG = ORIGINAL_DEBUG
  vi.restoreAllMocks()
})

describe('isKsefDebugEnabled', () => {
  it.each(['1', 'true', 'TRUE', 'yes', 'on', ' 1 '])('treats %j as enabled', (value) => {
    process.env.KSEF_DEBUG = value
    expect(isKsefDebugEnabled()).toBe(true)
  })

  it.each(['0', 'false', 'no', 'off', ''])('treats %j as disabled', (value) => {
    process.env.KSEF_DEBUG = value
    expect(isKsefDebugEnabled()).toBe(false)
  })

  it('is disabled when unset', () => {
    delete process.env.KSEF_DEBUG
    expect(isKsefDebugEnabled()).toBe(false)
  })
})

describe('ksefDebug', () => {
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('emits nothing when KSEF_DEBUG is unset', () => {
    delete process.env.KSEF_DEBUG
    ksefDebug('KSeF Auth', 'hello')
    expect(log).not.toHaveBeenCalled()
  })

  it('emits a scoped line when KSEF_DEBUG is set', () => {
    process.env.KSEF_DEBUG = '1'
    ksefDebug('KSeF Auth', 'hello', 42)
    expect(log).toHaveBeenCalledWith('[KSeF Auth] hello', 42)
  })
})

describe('redactHeaders', () => {
  it('masks sensitive headers regardless of casing', () => {
    expect(
      redactHeaders({
        Authorization: 'Bearer eyJhbGciOi.secret.value',
        'content-type': 'application/json',
        COOKIE: 'session=abc',
      })
    ).toEqual({
      Authorization: '[redacted]',
      'content-type': 'application/json',
      COOKIE: '[redacted]',
    })
  })

  it('accepts a Headers instance', () => {
    const headers = new Headers({ authorization: 'Bearer secret', accept: 'application/json' })
    expect(redactHeaders(headers)).toEqual({
      authorization: '[redacted]',
      accept: 'application/json',
    })
  })

  it('accepts entry tuples', () => {
    expect(redactHeaders([['Authorization', 'Bearer secret']])).toEqual({
      Authorization: '[redacted]',
    })
  })

  it('returns an empty object for undefined', () => {
    expect(redactHeaders(undefined)).toEqual({})
  })

  it('never lets token material through, even with debug on', () => {
    process.env.KSEF_DEBUG = '1'
    const serialized = JSON.stringify(redactHeaders({ Authorization: 'Bearer super-secret-token' }))
    expect(serialized).not.toContain('super-secret-token')
  })
})

describe('describeSecret', () => {
  it('reports length without content', () => {
    expect(describeSecret('super-secret-token')).toBe('present (18 chars)')
  })

  it.each([null, undefined, ''])('reports %j as absent', (value) => {
    expect(describeSecret(value)).toBe('absent')
  })
})
