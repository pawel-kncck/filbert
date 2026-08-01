'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'

import { validateFA3 } from '@/lib/ksef/fa3-validator'
import { INVOICE_INPUT_CLASS } from './types'

/**
 * FA(3) validation state for the invoice form.
 *
 * `validateFA3` reports failures as `{ field, messageKey }`; we keep the raw
 * message keys in state and translate on read, so the stored errors stay
 * locale-independent. Field paths are dotted (`items.0.quantity`), which is
 * what lets a single map cover both header and line-item fields.
 */
export function useInvoiceValidation() {
  const t = useTranslations('invoices.form')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  /** Row removal shifts every later index, so all item errors are dropped. */
  const clearItemErrors = useCallback(() => {
    setFieldErrors((prev) => {
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith('items.')) next[key] = value
      }
      return next
    })
  }, [])

  const getFieldError = useCallback(
    (field: string): string | undefined => {
      const messageKey = fieldErrors[field]
      return messageKey ? t(messageKey) : undefined
    },
    [fieldErrors, t]
  )

  const getItemFieldError = useCallback(
    (index: number, field: string) => getFieldError(`items.${index}.${field}`),
    [getFieldError]
  )

  const hasItemError = useCallback(
    (index: number) => Object.keys(fieldErrors).some((key) => key.startsWith(`items.${index}.`)),
    [fieldErrors]
  )

  /** Props shared by every control in the form, including the invalid state. */
  const fieldProps = useCallback(
    (field: string) => ({ invalid: !!fieldErrors[field], className: INVOICE_INPUT_CLASS }),
    [fieldErrors]
  )

  const itemFieldProps = useCallback(
    (index: number, field: string) => fieldProps(`items.${index}.${field}`),
    [fieldProps]
  )

  /** Runs FA(3) validation, populating state. Returns true when the form may submit. */
  const validate = useCallback(
    (data: Parameters<typeof validateFA3>[0]) => {
      setError('')
      setFieldErrors({})

      const result = validateFA3(data)
      if (result.valid) return true

      const errors: Record<string, string> = {}
      const messages: string[] = []
      for (const err of result.errors) {
        errors[err.field] = err.messageKey
        messages.push(t(err.messageKey))
      }
      setFieldErrors(errors)
      setError(messages[0] || t('errors.generic'))
      return false
    },
    [t]
  )

  return {
    error,
    setError,
    errorCount: Object.keys(fieldErrors).length,
    validate,
    clearFieldError,
    clearItemErrors,
    getFieldError,
    getItemFieldError,
    hasItemError,
    fieldProps,
    itemFieldProps,
  }
}

export type InvoiceValidation = ReturnType<typeof useInvoiceValidation>
