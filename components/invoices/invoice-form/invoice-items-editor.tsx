'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input, SelectInput } from '@/components/ui/input'
import { FieldError } from '@/components/ui/form-field'
import { formatAmount, type ItemRow } from './types'
import type { InvoiceValidation } from './use-invoice-validation'

type Props = {
  items: ItemRow[]
  totals: { net: number; vat: number; gross: number }
  onUpdate: (key: number, field: keyof ItemRow, value: string) => void
  onAdd: () => void
  onRemove: (key: number) => void
  validation: InvoiceValidation
}

/** The editable line-item card: add/remove rows, per-row fields, and totals. */
export function InvoiceItemsEditor({
  items,
  totals,
  onUpdate,
  onAdd,
  onRemove,
  validation,
}: Props) {
  const t = useTranslations('invoices.form')

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {t('items')}
        </h2>
        <Button type="button" size="sm" onClick={onAdd} className="gap-1">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('addItem')}
        </Button>
      </div>

      {validation.getFieldError('items') && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {validation.getFieldError('items')}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {items.map((item, index) => (
          <ItemRowFields
            key={item.key}
            item={item}
            index={index}
            removable={items.length > 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
            validation={validation}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-600">
        <div className="flex items-center justify-end gap-6 text-sm">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">{t('totals')}:</span>
          <Total label={t('net')} value={totals.net} />
          <Total label={t('vat')} value={totals.vat} />
          <Total label={t('gross')} value={totals.gross} accent />
        </div>
      </div>
    </div>
  )
}

function ItemRowFields({
  item,
  index,
  removable,
  onUpdate,
  onRemove,
  validation,
}: {
  item: ItemRow
  index: number
  removable: boolean
  onUpdate: (key: number, field: keyof ItemRow, value: string) => void
  onRemove: (key: number) => void
  validation: InvoiceValidation
}) {
  const t = useTranslations('invoices.form')
  const { getItemFieldError, itemFieldProps } = validation
  const error = (field: string) => getItemFieldError(index, field)

  return (
    <div
      className={`rounded-md border p-4 ${
        validation.hasItemError(index)
          ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
          : 'border-zinc-100 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">#{index + 1}</span>
        {removable && (
          <Button
            type="button"
            variant="link"
            size="none"
            onClick={() => onRemove(item.key)}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-400"
          >
            {t('removeItem')}
          </Button>
        )}
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-6">
        <ItemField
          label={t('description')}
          required
          error={error('description')}
          className="sm:col-span-3"
        >
          <Input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate(item.key, 'description', e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            {...itemFieldProps(index, 'description')}
            maxLength={256}
          />
        </ItemField>
        <ItemField label={t('quantity')} required error={error('quantity')}>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={item.quantity}
            onChange={(e) => onUpdate(item.key, 'quantity', e.target.value)}
            {...itemFieldProps(index, 'quantity')}
          />
        </ItemField>
        <ItemField label={t('unit')} error={error('unit')}>
          <Input
            type="text"
            value={item.unit}
            onChange={(e) => onUpdate(item.key, 'unit', e.target.value)}
            {...itemFieldProps(index, 'unit')}
          />
        </ItemField>
        <ItemField label={t('unitPrice')} required error={error('unit_price')}>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.unit_price}
            onChange={(e) => onUpdate(item.key, 'unit_price', e.target.value)}
            {...itemFieldProps(index, 'unit_price')}
          />
        </ItemField>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <ItemField label={t('vatRate')} error={error('vat_rate')}>
          <SelectInput
            value={item.vat_rate}
            onChange={(e) => onUpdate(item.key, 'vat_rate', e.target.value)}
            {...itemFieldProps(index, 'vat_rate')}
          >
            <option value="23">23%</option>
            <option value="8">8%</option>
            <option value="5">5%</option>
            <option value="0">0%</option>
          </SelectInput>
        </ItemField>
        <ItemField label={t('net')}>
          <ComputedAmount value={item.net_amount} />
        </ItemField>
        <ItemField label={t('vat')}>
          <ComputedAmount value={item.vat_amount} />
        </ItemField>
        <ItemField label={t('gross')}>
          <ComputedAmount value={item.gross_amount} emphasis />
        </ItemField>
      </div>
    </div>
  )
}

/**
 * Compact label + control + error. Distinct from `ui/FormField`: item rows use
 * a smaller, muted label to fit the dense grid.
 */
function ItemField({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="text-xs text-zinc-500 dark:text-zinc-400">
        {label}
        {required && ' *'}
      </label>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

/** Read-only derived amount, styled to line up with the inputs beside it. */
function ComputedAmount({ value, emphasis }: { value: number; emphasis?: boolean }) {
  return (
    <div
      className={`mt-1 rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-600 ${
        emphasis ? 'font-medium text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-200'
      }`}
    >
      {formatAmount(value)}
    </div>
  )
}

function Total({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <p
        className={
          accent
            ? 'font-medium text-blue-600 dark:text-blue-400'
            : 'font-medium text-zinc-900 dark:text-white'
        }
      >
        {formatAmount(value)}
      </p>
    </div>
  )
}
