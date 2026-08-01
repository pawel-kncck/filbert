/**
 * Parses FA(3) invoice XML downloaded from KSeF into the app's invoice shape.
 *
 * **Field reference: `docs/ksef/FA3_FIELD_MAPPING.md`.** FA(3) field names are
 * positional (`P_7`, `P_11`, `P_13_1`…) and carry no meaning on their own —
 * consult that document before touching a field here. Its "Parsing Notes"
 * section describes the amount-derivation and summary-vs-items rules this file
 * implements, and "Common Issues" covers the failure modes they exist to
 * handle. The authoritative schema is `docs/ksef/schemat_FA(3)_v1-0E.xsd`;
 * `lib/ksef/fa3-xml-builder.ts` writes the same format.
 *
 * This parser is deliberately lenient, because it consumes documents produced
 * by every other vendor's software, not just ours:
 *
 * - **Amounts are derived when absent.** An invoice may be priced net (`P_9A`,
 *   `P_11`) or gross (`P_9B`, `P_11A`), and may omit `P_11Vat`. Missing values
 *   are reconstructed from whichever combination is present plus the VAT rate,
 *   rather than defaulting to zero.
 * - **Summary totals win over line sums.** The `P_13_*` / `P_14_*` summary
 *   fields are the official totals, so they are preferred; item sums are the
 *   fallback when the summary is absent or zero.
 * - **The root element is located flexibly** (`Faktura`, a namespaced variant,
 *   or the first object node), since namespace prefixes vary by issuer.
 *
 * Set `KSEF_DEBUG` to trace field-by-field extraction; the traces include full
 * invoice contents and are off by default (see `./logger`).
 */
import { XMLParser } from 'fast-xml-parser'

import { ksefDebug } from './logger'

export type ParsedKsefItem = {
  position: number
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
  netAmount: number
  vatAmount: number
  grossAmount: number
}

export type ParsedKsefInvoice = {
  invoiceNumber: string
  issueDate: string
  vendorName: string
  vendorNip: string | null
  customerName: string
  customerNip: string | null
  currency: string
  netAmount: number
  vatAmount: number
  grossAmount: number
  items: ParsedKsefItem[]
}

/**
 * UN/ECE Recommendation 20 codes back to app unit labels — the inverse of
 * `UNIT_MAP` in `fa3-xml-builder.ts`. Unknown codes pass through unchanged.
 */
const UNIT_REVERSE_MAP: Record<string, string> = {
  C62: 'szt.',
  HUR: 'godz.',
  KGM: 'kg',
  MTR: 'm',
  MTK: 'm²',
}

/**
 * Parses an FA(3) XML document into the app's invoice shape.
 *
 * Applies the leniency rules described in the module block: amounts are derived
 * when the issuer omitted them, and the official `P_13_*` / `P_14_*` summary
 * totals take precedence over the sum of line items. Line items without a
 * description (`P_7`) are skipped, since FA(3) uses `FaWiersz` for some
 * non-item rows.
 *
 * @param xml Raw FA(3) document, as returned by `KsefApiClient.getInvoice`.
 * @returns The parsed invoice. Missing optional fields become `''`, `null` or
 *   `0` rather than throwing — a partially-populated invoice is more useful
 *   than a failed import.
 * @throws If the document has no recognisable `Faktura` root element, the only
 *   condition treated as unparseable.
 */
export function parseFA3Xml(xml: string): ParsedKsefInvoice {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: true,
    trimValues: true,
    isArray: (name) => name === 'FaWiersz',
  })

  const doc = parser.parse(xml)
  ksefDebug('FA3 Parser', 'Parsed doc keys:', Object.keys(doc))

  const faktura = doc.Faktura || doc['ns0:Faktura'] || Object.values(doc).find(isObject)

  if (!faktura) {
    ksefDebug('FA3 Parser', 'Full doc:', JSON.stringify(doc, null, 2).substring(0, 2000))
    throw new Error('Invalid FA(3) XML: missing Faktura root element')
  }

  ksefDebug('FA3 Parser', 'Faktura keys:', Object.keys(faktura))

  const podmiot1 = faktura.Podmiot1 || {}
  const podmiot2 = faktura.Podmiot2 || {}
  const fa = faktura.Fa || {}

  ksefDebug('FA3 Parser', 'Fa keys:', Object.keys(fa))
  ksefDebug('FA3 Parser', 'Fa.P_15 (gross):', fa.P_15)
  ksefDebug('FA3 Parser', 'Fa.P_13_1 (net 23%):', fa.P_13_1)
  ksefDebug('FA3 Parser', 'Fa.P_14_1 (vat 23%):', fa.P_14_1)
  ksefDebug('FA3 Parser', 'FaWiersz:', JSON.stringify(fa.FaWiersz, null, 2)?.substring(0, 1000))

  const vendorId = podmiot1.DaneIdentyfikacyjne || {}
  const buyerId = podmiot2.DaneIdentyfikacyjne || {}

  const wiersze = fa.FaWiersz || []
  const itemList = Array.isArray(wiersze) ? wiersze : [wiersze]

  const items: ParsedKsefItem[] = itemList
    .filter((w: Record<string, unknown>) => w && w.P_7)
    .map((w: Record<string, unknown>, index: number) => {
      ksefDebug('FA3 Parser', 'Line item fields:', Object.keys(w))
      ksefDebug(
        'FA3 Parser',
        'P_11 (net):',
        w.P_11,
        '| P_11A (gross):',
        w.P_11A,
        '| P_11Vat (vat):',
        w.P_11Vat
      )
      ksefDebug(
        'FA3 Parser',
        'P_9A (unit price net):',
        w.P_9A,
        '| P_9B (unit price gross):',
        w.P_9B
      )
      ksefDebug('FA3 Parser', 'P_12 (vat rate):', w.P_12)

      // FA(3) schema:
      // P_11 = net amount (wartość netto)
      // P_11A = gross amount (wartość brutto) - used for gross pricing mode
      // P_11Vat = VAT amount
      // P_9A = unit price net
      // P_9B = unit price gross

      const quantity = toNumber(w.P_8A) || 1
      const vatRate = toNumber(w.P_12)

      let netAmount = toNumber(w.P_11)
      let grossAmount = toNumber(w.P_11A)
      let vatAmount = toNumber(w.P_11Vat)

      // Calculate missing values based on what's available
      if (netAmount === 0 && w.P_9A) {
        // Calculate net from unit price net * quantity
        netAmount = Math.round(toNumber(w.P_9A) * quantity * 100) / 100
      }

      if (grossAmount === 0 && w.P_9B) {
        // Calculate gross from unit price gross * quantity
        grossAmount = Math.round(toNumber(w.P_9B) * quantity * 100) / 100
      }

      // If we have net but no VAT, calculate VAT from rate
      if (netAmount > 0 && vatAmount === 0 && vatRate > 0) {
        vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100
      }

      // If we have gross but no net, calculate net (gross pricing mode)
      if (grossAmount > 0 && netAmount === 0 && vatRate > 0) {
        netAmount = Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100
        vatAmount = Math.round((grossAmount - netAmount) * 100) / 100
      }

      // If we have net and VAT but no gross, calculate gross
      if (grossAmount === 0) {
        grossAmount = Math.round((netAmount + vatAmount) * 100) / 100
      }

      ksefDebug(
        'FA3 Parser',
        'Calculated: net=',
        netAmount,
        'vat=',
        vatAmount,
        'gross=',
        grossAmount
      )

      return {
        position: toNumber(w.NrWierszaFa) || index + 1,
        description: String(w.P_7 || ''),
        quantity,
        unit: UNIT_REVERSE_MAP[String(w.P_8B || '')] || String(w.P_8B || 'szt.'),
        unitPrice: toNumber(w.P_9A) || toNumber(w.P_9B),
        vatRate,
        netAmount,
        vatAmount,
        grossAmount,
      }
    })

  const netAmountFromItems = items.reduce((sum, item) => sum + item.netAmount, 0)
  const vatAmountFromItems = items.reduce((sum, item) => sum + item.vatAmount, 0)

  // Calculate totals from P_13_* (net by VAT rate) and P_14_* (VAT by rate) summary fields
  // P_13_1/P_14_1 = 23%, P_13_2/P_14_2 = 8%, P_13_3/P_14_3 = 5%, etc.
  const netAmountFromSummary =
    toNumber(fa.P_13_1) +
    toNumber(fa.P_13_2) +
    toNumber(fa.P_13_3) +
    toNumber(fa.P_13_4) +
    toNumber(fa.P_13_5) +
    toNumber(fa.P_13_6_1) +
    toNumber(fa.P_13_6_2) +
    toNumber(fa.P_13_6_3) +
    toNumber(fa.P_13_7) +
    toNumber(fa.P_13_8) +
    toNumber(fa.P_13_9) +
    toNumber(fa.P_13_10) +
    toNumber(fa.P_13_11)

  const vatAmountFromSummary =
    toNumber(fa.P_14_1) +
    toNumber(fa.P_14_2) +
    toNumber(fa.P_14_3) +
    toNumber(fa.P_14_4) +
    toNumber(fa.P_14_5)

  ksefDebug(
    'FA3 Parser',
    'Net from items:',
    netAmountFromItems,
    '| Net from summary (P_13_*):',
    netAmountFromSummary
  )
  ksefDebug(
    'FA3 Parser',
    'VAT from items:',
    vatAmountFromItems,
    '| VAT from summary (P_14_*):',
    vatAmountFromSummary
  )

  // Prefer summary fields (P_13_*, P_14_*) as they are the official totals
  // Fall back to item sums if summary is 0
  const netAmount = netAmountFromSummary > 0 ? netAmountFromSummary : netAmountFromItems
  const vatAmount = vatAmountFromSummary > 0 ? vatAmountFromSummary : vatAmountFromItems
  const grossAmount = toNumber(fa.P_15) || Math.round((netAmount + vatAmount) * 100) / 100

  ksefDebug('FA3 Parser', 'Final: net=', netAmount, 'vat=', vatAmount, 'gross=', grossAmount)

  const result = {
    invoiceNumber: String(fa.P_2 || ''),
    issueDate: String(fa.P_1 || ''),
    vendorName: String(vendorId.Nazwa || ''),
    vendorNip: vendorId.NIP ? String(vendorId.NIP) : null,
    customerName: String(buyerId.Nazwa || ''),
    customerNip: buyerId.NIP ? String(buyerId.NIP) : null,
    currency: String(fa.KodWaluty || 'PLN'),
    netAmount: Math.round(netAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    grossAmount: Math.round(grossAmount * 100) / 100,
    items,
  }

  ksefDebug(
    'FA3 Parser',
    'Parsed result: net=',
    result.netAmount,
    'vat=',
    result.vatAmount,
    'gross=',
    result.grossAmount,
    '| items:',
    items.length
  )

  return result
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
