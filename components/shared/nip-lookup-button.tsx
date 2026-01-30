'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useNipLookup } from '@/lib/hooks/use-nip-lookup'
import type { GusFormattedResult } from '@/lib/gus/types'

type Props = {
  nip: string
  onResult: (data: GusFormattedResult) => void
  onError?: (errorKey: string) => void
}

export function NipLookupButton({ nip, onResult, onError }: Props) {
  const t = useTranslations()
  const { loading, error, data, lookup, reset } = useNipLookup()

  const cleanNip = nip.replace(/[-\s]/g, '')
  const isValidNip = /^\d{10}$/.test(cleanNip)

  useEffect(() => {
    if (data) {
      onResult(data)
      reset()
    }
  }, [data, onResult, reset])

  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  return (
    <button
      type="button"
      onClick={() => lookup(nip)}
      disabled={!isValidNip || loading}
      title={t('gus.lookupTooltip')}
      className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      )}
    </button>
  )
}
