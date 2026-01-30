'use client'

import { useState, useCallback } from 'react'
import type { GusFormattedResult } from '@/lib/gus/types'

type NipLookupState = {
  loading: boolean
  error: string | null
  data: GusFormattedResult | null
}

export function useNipLookup() {
  const [state, setState] = useState<NipLookupState>({
    loading: false,
    error: null,
    data: null,
  })

  const lookup = useCallback(async (nip: string) => {
    const cleanNip = nip.replace(/[-\s]/g, '')
    if (!/^\d{10}$/.test(cleanNip)) {
      setState({ loading: false, error: 'gus.errors.invalidNip', data: null })
      return
    }

    setState({ loading: true, error: null, data: null })

    try {
      const res = await fetch(`/api/gus/lookup?nip=${cleanNip}`)
      const json = await res.json()

      if (!res.ok) {
        const errorCode = json.error?.code || 'API_ERROR'
        const errorKeyMap: Record<string, string> = {
          NOT_FOUND: 'gus.errors.notFound',
          RATE_LIMITED: 'gus.errors.rateLimited',
          INVALID_NIP: 'gus.errors.invalidNip',
          CONNECTION_ERROR: 'gus.errors.connection',
          AUTH_FAILED: 'gus.errors.connection',
          SESSION_FAILED: 'gus.errors.connection',
          PARSE_ERROR: 'gus.errors.generic',
          API_ERROR: 'gus.errors.generic',
        }
        setState({
          loading: false,
          error: errorKeyMap[errorCode] || 'gus.errors.generic',
          data: null,
        })
        return
      }

      setState({ loading: false, error: null, data: json.data })
    } catch {
      setState({ loading: false, error: 'gus.errors.connection', data: null })
    }
  }, [])

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null })
  }, [])

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    lookup,
    reset,
  }
}
