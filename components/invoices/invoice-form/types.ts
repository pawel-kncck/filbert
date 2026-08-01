/**
 * Line items are held as strings while editing (an empty `unit_price` must stay
 * empty rather than collapsing to 0), with the derived amounts recomputed on
 * every keystroke. `key` is a stable React key that survives row removal.
 */
export type ItemRow = {
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

export function emptyItem(key: number): ItemRow {
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

/** Recomputes net/VAT/gross from quantity × unit price × VAT rate, to the grosz. */
export function recalcItem(item: ItemRow): ItemRow {
  const qty = parseFloat(item.quantity) || 0
  const price = parseFloat(item.unit_price) || 0
  const vatRate = parseFloat(item.vat_rate) || 0
  const net = Math.round(qty * price * 100) / 100
  const vat = Math.round(net * (vatRate / 100) * 100) / 100
  const gross = Math.round((net + vat) * 100) / 100
  return { ...item, net_amount: net, vat_amount: vat, gross_amount: gross }
}

/** String rows → the numeric shape the FA(3) validator and the API expect. */
export function toPayloadItems(items: ItemRow[]) {
  return items.map((item) => ({
    description: item.description.trim(),
    quantity: parseFloat(item.quantity) || 0,
    unit: item.unit,
    unit_price: parseFloat(item.unit_price) || 0,
    vat_rate: parseFloat(item.vat_rate) || 0,
    net_amount: item.net_amount,
    vat_amount: item.vat_amount,
    gross_amount: item.gross_amount,
  }))
}

export function formatAmount(amount: number) {
  return amount.toFixed(2)
}

/** This form's inputs predate `shadow-sm` and set an explicit placeholder colour. */
export const INVOICE_INPUT_CLASS =
  'mt-1 shadow-none placeholder:text-zinc-400 dark:placeholder:text-zinc-400'
