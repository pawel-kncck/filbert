'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

  const today = new Date().toISOString().split('T')[0]

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

  const updateItem = (key: number, field: keyof ItemRow, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        const updated = { ...item, [field]: value }
        return recalcItem(updated)
      })
    )
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
  }

  const totalNet = items.reduce((sum, item) => sum + item.net_amount, 0)
  const totalVat = items.reduce((sum, item) => sum + item.vat_amount, 0)
  const totalGross = items.reduce((sum, item) => sum + item.gross_amount, 0)

  const formatAmount = (amount: number) => {
    return amount.toFixed(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!invoiceNumber.trim()) {
      setError(t('errors.invoiceNumberRequired'))
      return
    }
    if (!customerName.trim()) {
      setError(t('errors.customerNameRequired'))
      return
    }
    if (customerNip && !/^\d{10}$/.test(customerNip.replace(/[-\s]/g, ''))) {
      setError(t('errors.invalidNip'))
      return
    }
    if (items.length === 0) {
      setError(t('errors.atLeastOneItem'))
      return
    }
    for (const item of items) {
      if (!item.description.trim()) {
        setError(t('errors.itemDescriptionRequired'))
        return
      }
      if ((parseFloat(item.quantity) || 0) <= 0) {
        setError(t('errors.itemQuantityPositive'))
        return
      }
      if ((parseFloat(item.unit_price) || 0) < 0) {
        setError(t('errors.itemPriceNonNegative'))
        return
      }
    }

    setSaving(true)

    try {
      const cleanNip = customerNip ? customerNip.replace(/[-\s]/g, '') : null
      const payload = {
        company_id: companyId,
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        customer_name: customerName.trim(),
        customer_nip: cleanNip && /^\d{10}$/.test(cleanNip) ? cleanNip : null,
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

  const inputClass =
    'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder:text-zinc-400'
  const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Invoice header fields */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="invoiceNumber" className={labelClass}>
              {t('invoiceNumber')} *
            </label>
            <input
              id="invoiceNumber"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder={t('invoiceNumberPlaceholder')}
              className={`mt-1 ${inputClass}`}
              required
              maxLength={256}
            />
          </div>
          <div>
            <label htmlFor="issueDate" className={labelClass}>
              {t('issueDate')} *
            </label>
            <input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={`mt-1 ${inputClass}`}
              required
            />
          </div>
          <div>
            <label htmlFor="currency" className={labelClass}>
              {t('currency')}
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customerName" className={labelClass}>
              {t('customerName')} *
            </label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('customerNamePlaceholder')}
              className={`mt-1 ${inputClass}`}
              required
              maxLength={256}
            />
          </div>
          <div>
            <label htmlFor="customerNip" className={labelClass}>
              {t('customerNip')}
            </label>
            <input
              id="customerNip"
              type="text"
              value={customerNip}
              onChange={(e) => setCustomerNip(e.target.value)}
              placeholder={t('customerNipPlaceholder')}
              className={`mt-1 ${inputClass}`}
              maxLength={13}
            />
            <p className="mt-1 text-xs text-zinc-500">{t('nipHint')}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('items')}
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('addItem')}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="rounded-md border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-600 dark:bg-zinc-700/50"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  #{index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    {t('removeItem')}
                  </button>
                )}
              </div>

              <div className="mt-2 grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('description')} *
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.key, 'description', e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                    className={`mt-1 ${inputClass}`}
                    required
                    maxLength={256}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('quantity')} *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, 'quantity', e.target.value)}
                    className={`mt-1 ${inputClass}`}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('unit')}</label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => updateItem(item.key, 'unit', e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('unitPrice')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => updateItem(item.key, 'unit_price', e.target.value)}
                    className={`mt-1 ${inputClass}`}
                    required
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('vatRate')}</label>
                  <select
                    value={item.vat_rate}
                    onChange={(e) => updateItem(item.key, 'vat_rate', e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="23">23%</option>
                    <option value="8">8%</option>
                    <option value="5">5%</option>
                    <option value="0">0%</option>
                  </select>
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
          ))}
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
        <button
          type="button"
          onClick={() => router.push(`/sales?company=${companyId}`)}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}
