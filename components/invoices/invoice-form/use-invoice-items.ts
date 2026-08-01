'use client'

import { useCallback, useState } from 'react'

import type { InvoiceItem } from '@/lib/types/database'
import { emptyItem, recalcItem, type ItemRow } from './types'

type Options = {
  /** Line items to seed from when copying an existing invoice. */
  copyItems?: InvoiceItem[]
  /** Called with the dotted field path whenever a cell changes, to clear its error. */
  onFieldChanged: (field: string) => void
  /** Called after a row is removed, since removal shifts every later index. */
  onRowsReindexed: () => void
}

function buildInitialItems(copyItems?: InvoiceItem[]): ItemRow[] {
  if (copyItems && copyItems.length > 0) {
    return copyItems.map((item, index) =>
      recalcItem({
        key: index,
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit,
        unit_price: String(item.unit_price),
        vat_rate: String(item.vat_rate),
        net_amount: 0,
        vat_amount: 0,
        gross_amount: 0,
      })
    )
  }
  return [emptyItem(0)]
}

/** Line-item rows plus their add/update/remove operations and running totals. */
export function useInvoiceItems({ copyItems, onFieldChanged, onRowsReindexed }: Options) {
  const [items, setItems] = useState<ItemRow[]>(() => buildInitialItems(copyItems))
  const [nextKey, setNextKey] = useState(items.length)

  const updateItem = useCallback(
    (key: number, field: keyof ItemRow, value: string) => {
      const index = items.findIndex((item) => item.key === key)
      if (index === -1) return
      onFieldChanged(`items.${index}.${field}`)
      setItems((prev) =>
        prev.map((item) => (item.key === key ? recalcItem({ ...item, [field]: value }) : item))
      )
    },
    [items, onFieldChanged]
  )

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem(nextKey)])
    setNextKey((key) => key + 1)
  }, [nextKey])

  const removeItem = useCallback(
    (key: number) => {
      // The form always keeps at least one row.
      setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.key !== key)))
      onRowsReindexed()
    },
    [onRowsReindexed]
  )

  const totals = {
    net: items.reduce((sum, item) => sum + item.net_amount, 0),
    vat: items.reduce((sum, item) => sum + item.vat_amount, 0),
    gross: items.reduce((sum, item) => sum + item.gross_amount, 0),
  }

  return { items, updateItem, addItem, removeItem, totals }
}
