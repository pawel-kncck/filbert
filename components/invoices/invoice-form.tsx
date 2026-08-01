'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { validateFA3 } from '@/lib/ksef/fa3-validator'
import { Button } from '@/components/ui/button'
import { Input, SelectInput } from '@/components/ui/input'
import { normalizeNip } from '@/lib/validations/nip'
import type { Invoice, InvoiceItem } from '@/lib/types/database'

type ItemRow = {
  key: number
  description: string
  quantity: string
  unit: string
  unit_price: string
  vat_rate: string
  net_amount: number
  vat_amount: number
  gross_amount: number
}

function emptyItem(key: number): ItemRow {
  return {
    key,
    description: '',
    quantity: '1',
    unit: 'szt.',
    unit_price: '',
    vat_rate: '23',
    net_amount: 0,
    vat_amount: 0,
    gross_amount: 0,
  }
}

function recalcItem(item: ItemRow): ItemRow {
  const qty = parseFloat(item.quantity) || 0
  const price = parseFloat(item.unit_price) || 0
  const vatRate = parseFloat(item.vat_rate) || 0
  const net = Math.round(qty * price * 100) / 100
  const vat = Math.round(net * (vatRate / 100) * 100) / 100
  const gross = Math.round((net + vat) * 100) / 100
  return { ...item, net_amount: net, vat_amount: vat, gross_amount: gross }
}

type Props = {
  companyId: string
  copyFrom?: Invoice | null
  copyItems?: InvoiceItem[]
  prefillCustomerName?: string
  prefillCustomerNip?: string
}

export function InvoiceForm({
  companyId,
  copyFrom,
  copyItems,
  prefillCustomerName,
  prefillCustomerNip,
}: Props) {
  const router = useRouter()
  const t = useTranslations('invoices.form')

  const today = new Date().toISOString().split('T')[0] ?? ''

  const [invoiceNumber, setInvoiceNumber] = useState(copyFrom ? '' : '')
  const [issueDate, setIssueDate] = useState(today)
  const [currency, setCurrency] = useState(copyFrom?.currency || 'PLN')
  const [customerName, setCustomerName] = useState(
    prefillCustomerName || copyFrom?.customer_name || ''
  )
  const [customerNip, setCustomerNip] = useState(prefillCustomerNip || copyFrom?.customer_nip || '')

  const buildInitialItems = useCallback((): ItemRow[] => {
    if (copyItems && copyItems.length > 0) {
      return copyItems.map((ci, i) =>
        recalcItem({
          key: i,
          description: ci.description,
          quantity: String(ci.quantity),
          unit: ci.unit,
          unit_price: String(ci.unit_price),
          vat_rate: String(ci.vat_rate),
          net_amount: 0,
          vat_amount: 0,
          gross_amount: 0,
        })
      )
    }
    return [emptyItem(0)]
  }, [copyItems])

  const [items, setItems] = useState<ItemRow[]>(buildInitialItems)
  const [nextKey, setNextKey] = useState(items.length)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const updateItem = (key: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.key === key)
      if (index === -1) return prev
      // Clear field-level error for this item field
      clearFieldError(`items.${index}.${field}`)
      return prev.map((item) => {
        if (item.key !== key) return item
        const updated = { ...item, [field]: value }
        return recalcItem(updated)
      })
    })
  }

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(nextKey)])
    setNextKey((k) => k + 1)
  }

  const removeItem = (key: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.key !== key)
    })
    // Clear all item errors since indices shift
    setFieldErrors((prev) => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith('items.')) next[k] = v
      }
      return next
    })
  }

  const totalNet = items.reduce((sum, item) => sum + item.net_amount, 0)
  const totalVat = items.reduce((sum, item) => sum + item.vat_amount, 0)
  const totalGross = items.reduce((sum, item) => sum + item.gross_amount, 0)

  const formatAmount = (amount: number) => {
    return amount.toFixed(2)
  }

  const getFieldError = (field: string): string | undefined => {
    const key = fieldErrors[field]
    if (!key) return undefined
    // Translate FA(3) error key, e.g. "fa3.invoiceNumberRequired" -> t("fa3.invoiceNumberRequired")
    return t(key)
  }

  const getItemFieldError = (index: number, field: string): string | undefined => {
    return getFieldError(`items.${index}.${field}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const cleanNip = customerNip ? normalizeNip(customerNip) : null

    // Build validation data
    const validationData = {
      invoice_number: invoiceNumber.trim(),
      issue_date: issueDate,
      customer_name: customerName.trim(),
      customer_nip: cleanNip && /^\d{10}$/.test(cleanNip) ? cleanNip : cleanNip || null,
      currency,
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        unit_price: parseFloat(item.unit_price) || 0,
        vat_rate: parseFloat(item.vat_rate) || 0,
        net_amount: item.net_amount,
        vat_amount: item.vat_amount,
        gross_amount: item.gross_amount,
      })),
    }

    // Run FA(3) validation
    const result = validateFA3(validationData)

    if (!result.valid) {
      const errors: Record<string, string> = {}
      const errorMessages: string[] = []

      for (const err of result.errors) {
        errors[err.field] = err.messageKey
        errorMessages.push(t(err.messageKey))
      }

      setFieldErrors(errors)
      setError(errorMessages[0] || t('errors.generic'))
      return
    }

    setSaving(true)

    try {
      const payload = {
        company_id: companyId,
        invoice_number: validationData.invoice_number,
        issue_date: validationData.issue_date,
        customer_name: validationData.customer_name,
        customer_nip: validationData.customer_nip,
        currency: validationData.currency,
        items: validationData.items,
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || t('errors.generic'))
        setSaving(false)
        return
      }

      const data = await res.json()
      router.push(`/sales/${data.invoice.id}?company=${companyId}`)
    } catch {
      setError(t('errors.generic'))
      setSaving(false)
    }
  }

  const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300'
  const errorTextClass = 'mt-1 text-xs text-red-600 dark:text-red-400'

  // The form's inputs predate `shadow-sm` and set an explicit placeholder colour.
  const INPUT_CLASS = 'mt-1 shadow-none placeholder:text-zinc-400 dark:placeholder:text-zinc-400'
  const fieldProps = (field: string) => ({
    invalid: !!fieldErrors[field],
    className: INPUT_CLASS,
  })
  const itemFieldProps = (index: number, field: string) => fieldProps(`items.${index}.${field}`)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error summary banner */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
          <div className="flex">
            <svg
              className="h-5 w-5 shrink-0 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
              {Object.keys(fieldErrors).length > 1 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {t('errors.generic').replace('.', '')}: {Object.keys(fieldErrors).length}{' '}
                  {Object.keys(fieldErrors).length === 1 ? 'error' : 'errors'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice header fields */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="invoiceNumber" className={labelClass}>
              {t('invoiceNumber')} *
            </label>
            <Input
              id="invoiceNumber"
              type="text"
              value={invoiceNumber}
              onChange={(e) => {
                setInvoiceNumber(e.target.value)
                clearFieldError('invoiceNumber')
              }}
              placeholder={t('invoiceNumberPlaceholder')}
              {...fieldProps('invoiceNumber')}
              maxLength={256}
            />
            {getFieldError('invoiceNumber') && (
              <p className={errorTextClass}>{getFieldError('invoiceNumber')}</p>
            )}
          </div>
          <div>
            <label htmlFor="issueDate" className={labelClass}>
              {t('issueDate')} *
            </label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value)
                clearFieldError('issueDate')
              }}
              {...fieldProps('issueDate')}
            />
            {getFieldError('issueDate') && (
              <p className={errorTextClass}>{getFieldError('issueDate')}</p>
            )}
          </div>
          <div>
            <label htmlFor="currency" className={labelClass}>
              {t('currency')}
            </label>
            <SelectInput
              id="currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value)
                clearFieldError('currency')
              }}
              {...fieldProps('currency')}
            >
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </SelectInput>
            {getFieldError('currency') && (
              <p className={errorTextClass}>{getFieldError('currency')}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customerName" className={labelClass}>
              {t('customerName')} *
            </label>
            <Input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                clearFieldError('customerName')
              }}
              placeholder={t('customerNamePlaceholder')}
              {...fieldProps('customerName')}
              maxLength={256}
            />
            {getFieldError('customerName') && (
              <p className={errorTextClass}>{getFieldError('customerName')}</p>
            )}
          </div>
          <div>
            <label htmlFor="customerNip" className={labelClass}>
              {t('customerNip')}
            </label>
            <Input
              id="customerNip"
              type="text"
              value={customerNip}
              onChange={(e) => {
                setCustomerNip(e.target.value)
                clearFieldError('customerNip')
              }}
              placeholder={t('customerNipPlaceholder')}
              {...fieldProps('customerNip')}
              maxLength={13}
            />
            {getFieldError('customerNip') ? (
              <p className={errorTextClass}>{getFieldError('customerNip')}</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">{t('nipHint')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('items')}
          </h2>
          <Button type="button" size="sm" onClick={addItem} className="gap-1">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('addItem')}
          </Button>
        </div>

        {getFieldError('items') && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{getFieldError('items')}</p>
        )}

        <div className="mt-4 space-y-4">
          {items.map((item, index) => {
            const hasItemError = Object.keys(fieldErrors).some((k) =>
              k.startsWith(`items.${index}.`)
            )
            return (
              <div
                key={item.key}
                className={`rounded-md border p-4 ${
                  hasItemError
                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                    : 'border-zinc-100 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    #{index + 1}
                  </span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="link"
                      size="none"
                      onClick={() => removeItem(item.key)}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-400"
                    >
                      {t('removeItem')}
                    </Button>
                  )}
                </div>

                <div className="mt-2 grid gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('description')} *
                    </label>
                    <Input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.key, 'description', e.target.value)}
                      placeholder={t('descriptionPlaceholder')}
                      {...itemFieldProps(index, 'description')}
                      maxLength={256}
                    />
                    {getItemFieldError(index, 'description') && (
                      <p className={errorTextClass}>{getItemFieldError(index, 'description')}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('quantity')} *
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, 'quantity', e.target.value)}
                      {...itemFieldProps(index, 'quantity')}
                    />
                    {getItemFieldError(index, 'quantity') && (
                      <p className={errorTextClass}>{getItemFieldError(index, 'quantity')}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('unit')}</label>
                    <Input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(item.key, 'unit', e.target.value)}
                      {...itemFieldProps(index, 'unit')}
                    />
                    {getItemFieldError(index, 'unit') && (
                      <p className={errorTextClass}>{getItemFieldError(index, 'unit')}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('unitPrice')} *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.key, 'unit_price', e.target.value)}
                      {...itemFieldProps(index, 'unit_price')}
                    />
                    {getItemFieldError(index, 'unit_price') && (
                      <p className={errorTextClass}>{getItemFieldError(index, 'unit_price')}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('vatRate')}
                    </label>
                    <SelectInput
                      value={item.vat_rate}
                      onChange={(e) => updateItem(item.key, 'vat_rate', e.target.value)}
                      {...itemFieldProps(index, 'vat_rate')}
                    >
                      <option value="23">23%</option>
                      <option value="8">8%</option>
                      <option value="5">5%</option>
                      <option value="0">0%</option>
                    </SelectInput>
                    {getItemFieldError(index, 'vat_rate') && (
                      <p className={errorTextClass}>{getItemFieldError(index, 'vat_rate')}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('net')}</label>
                    <div className="mt-1 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200">
                      {formatAmount(item.net_amount)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('vat')}</label>
                    <div className="mt-1 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200">
                      {formatAmount(item.vat_amount)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('gross')}</label>
                    <div className="mt-1 rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 dark:bg-zinc-600 dark:text-white">
                      {formatAmount(item.gross_amount)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Totals */}
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-600">
          <div className="flex items-center justify-end gap-6 text-sm">
            <span className="font-medium text-zinc-500 dark:text-zinc-400">{t('totals')}:</span>
            <div className="text-right">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('net')}</span>
              <p className="font-medium text-zinc-900 dark:text-white">{formatAmount(totalNet)}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('vat')}</span>
              <p className="font-medium text-zinc-900 dark:text-white">{formatAmount(totalVat)}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('gross')}</span>
              <p className="font-medium text-blue-600 dark:text-blue-400">
                {formatAmount(totalGross)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/sales?company=${companyId}`)}
          className="bg-white dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  )
}
