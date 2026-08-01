'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input, SelectInput } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { normalizeNip } from '@/lib/validations/nip'
import type { Invoice, InvoiceItem } from '@/lib/types/database'
import { toPayloadItems } from './invoice-form/types'
import { useInvoiceItems } from './invoice-form/use-invoice-items'
import { useInvoiceValidation } from './invoice-form/use-invoice-validation'
import { InvoiceItemsEditor } from './invoice-form/invoice-items-editor'
import { InvoiceErrorSummary } from './invoice-form/error-summary'

type Props = {
  companyId: string
  copyFrom?: Invoice | null
  copyItems?: InvoiceItem[]
  prefillCustomerName?: string
  prefillCustomerNip?: string
}

/**
 * New-sales-invoice form. Header fields and submission live here; line items
 * are edited by `InvoiceItemsEditor` and FA(3) validation by
 * `useInvoiceValidation`.
 */
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

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [currency, setCurrency] = useState(copyFrom?.currency || 'PLN')
  const [customerName, setCustomerName] = useState(
    prefillCustomerName || copyFrom?.customer_name || ''
  )
  const [customerNip, setCustomerNip] = useState(prefillCustomerNip || copyFrom?.customer_nip || '')
  const [saving, setSaving] = useState(false)

  const validation = useInvoiceValidation()
  const { clearFieldError, clearItemErrors, getFieldError, fieldProps } = validation

  const { items, updateItem, addItem, removeItem, totals } = useInvoiceItems({
    copyItems,
    onFieldChanged: clearFieldError,
    onRowsReindexed: clearItemErrors,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanNip = customerNip ? normalizeNip(customerNip) : null
    const payload = {
      company_id: companyId,
      invoice_number: invoiceNumber.trim(),
      issue_date: issueDate,
      customer_name: customerName.trim(),
      customer_nip: cleanNip && /^\d{10}$/.test(cleanNip) ? cleanNip : cleanNip || null,
      currency,
      items: toPayloadItems(items),
    }

    if (!validation.validate(payload)) return

    setSaving(true)

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        validation.setError(data.error?.message || t('errors.generic'))
        setSaving(false)
        return
      }

      const data = await res.json()
      router.push(`/sales/${data.invoice.id}?company=${companyId}`)
    } catch {
      validation.setError(t('errors.generic'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {validation.error && (
        <InvoiceErrorSummary message={validation.error} errorCount={validation.errorCount} />
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label={t('invoiceNumber')}
            htmlFor="invoiceNumber"
            error={getFieldError('invoiceNumber')}
            required
          >
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
          </FormField>
          <FormField
            label={t('issueDate')}
            htmlFor="issueDate"
            error={getFieldError('issueDate')}
            required
          >
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
          </FormField>
          <FormField label={t('currency')} htmlFor="currency" error={getFieldError('currency')}>
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
          </FormField>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label={t('customerName')}
            htmlFor="customerName"
            error={getFieldError('customerName')}
            required
          >
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
          </FormField>
          <FormField
            label={t('customerNip')}
            htmlFor="customerNip"
            error={getFieldError('customerNip')}
            hint={t('nipHint')}
          >
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
          </FormField>
        </div>
      </div>

      <InvoiceItemsEditor
        items={items}
        totals={totals}
        onUpdate={updateItem}
        onAdd={addItem}
        onRemove={removeItem}
        validation={validation}
      />

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
