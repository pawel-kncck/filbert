'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useCallback } from 'react'

export function useFilterParams(basePath: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const getParam = useCallback((key: string) => searchParams.get(key) || '', [searchParams])

  const updateParams = useCallback(
    (updates: Record<string, string>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })

      if (resetPage) {
        params.delete('page')
      }

      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`)
      })
    },
    [searchParams, basePath, router]
  )

  const clearParams = useCallback(
    (keys: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      keys.forEach((key) => params.delete(key))
      params.delete('page')

      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`)
      })
    },
    [searchParams, basePath, router]
  )

  return {
    isPending,
    getParam,
    updateParams,
    clearParams,
    searchParams,
  }
}
