import { XMLParser } from 'fast-xml-parser'

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

const UNIT_REVERSE_MAP: Record<string, string> = {
  C62: 'szt.',
  HUR: 'godz.',
  KGM: 'kg',
  MTR: 'm',
  MTK: 'm²',
}

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
  console.log('[FA3 Parser] Parsed doc keys:', Object.keys(doc))

  const faktura = doc.Faktura || doc['ns0:Faktura'] || Object.values(doc).find(isObject)

  if (!faktura) {
    console.log('[FA3 Parser] Full doc:', JSON.stringify(doc, null, 2).substring(0, 2000))
    throw new Error('Invalid FA(3) XML: missing Faktura root element')
  }

  console.log('[FA3 Parser] Faktura keys:', Object.keys(faktura))

  const podmiot1 = faktura.Podmiot1 || {}
  const podmiot2 = faktura.Podmiot2 || {}
  const fa = faktura.Fa || {}

  console.log('[FA3 Parser] Fa keys:', Object.keys(fa))
  console.log('[FA3 Parser] Fa.P_15 (gross):', fa.P_15)
  console.log('[FA3 Parser] Fa.P_13_1 (net 23%):', fa.P_13_1)
  console.log('[FA3 Parser] Fa.P_14_1 (vat 23%):', fa.P_14_1)
  console.log('[FA3 Parser] FaWiersz:', JSON.stringify(fa.FaWiersz, null, 2)?.substring(0, 1000))

  const vendorId = podmiot1.DaneIdentyfikacyjne || {}
  const buyerId = podmiot2.DaneIdentyfikacyjne || {}

  const wiersze = fa.FaWiersz || []
  const itemList = Array.isArray(wiersze) ? wiersze : [wiersze]

  const items: ParsedKsefItem[] = itemList
    .filter((w: Record<string, unknown>) => w && w.P_7)
    .map((w: Record<string, unknown>, index: number) => {
      console.log('[FA3 Parser] Line item fields:', Object.keys(w))
      console.log(
        '[FA3 Parser] P_11 (net):',
        w.P_11,
        '| P_11A (gross):',
        w.P_11A,
        '| P_11Vat (vat):',
        w.P_11Vat
      )
      console.log(
        '[FA3 Parser] P_9A (unit price net):',
        w.P_9A,
        '| P_9B (unit price gross):',
        w.P_9B
      )
      console.log('[FA3 Parser] P_12 (vat rate):', w.P_12)

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

      console.log(
        '[FA3 Parser] Calculated: net=',
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

  console.log(
    '[FA3 Parser] Net from items:',
    netAmountFromItems,
    '| Net from summary (P_13_*):',
    netAmountFromSummary
  )
  console.log(
    '[FA3 Parser] VAT from items:',
    vatAmountFromItems,
    '| VAT from summary (P_14_*):',
    vatAmountFromSummary
  )

  // Prefer summary fields (P_13_*, P_14_*) as they are the official totals
  // Fall back to item sums if summary is 0
  const netAmount = netAmountFromSummary > 0 ? netAmountFromSummary : netAmountFromItems
  const vatAmount = vatAmountFromSummary > 0 ? vatAmountFromSummary : vatAmountFromItems
  const grossAmount = toNumber(fa.P_15) || Math.round((netAmount + vatAmount) * 100) / 100

  console.log('[FA3 Parser] Final: net=', netAmount, 'vat=', vatAmount, 'gross=', grossAmount)

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

  console.log('[FA3 Parser] ========== PARSED RESULT ==========')
  console.log('[FA3 Parser] netAmount:', result.netAmount)
  console.log('[FA3 Parser] vatAmount:', result.vatAmount)
  console.log('[FA3 Parser] grossAmount:', result.grossAmount)
  console.log('[FA3 Parser] items count:', items.length)

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
