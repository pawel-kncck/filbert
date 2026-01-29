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
  const faktura = doc.Faktura || doc['ns0:Faktura'] || Object.values(doc).find(isObject)

  if (!faktura) {
    throw new Error('Invalid FA(3) XML: missing Faktura root element')
  }

  const podmiot1 = faktura.Podmiot1 || {}
  const podmiot2 = faktura.Podmiot2 || {}
  const fa = faktura.Fa || {}

  const vendorId = podmiot1.DaneIdentyfikacyjne || {}
  const buyerId = podmiot2.DaneIdentyfikacyjne || {}

  const wiersze = fa.FaWiersz || []
  const itemList = Array.isArray(wiersze) ? wiersze : [wiersze]

  const items: ParsedKsefItem[] = itemList
    .filter((w: Record<string, unknown>) => w && w.P_7)
    .map((w: Record<string, unknown>, index: number) => {
      const netAmount = toNumber(w.P_11)
      const vatAmount = toNumber(w.P_11A)
      return {
        position: toNumber(w.NrWierszaFa) || index + 1,
        description: String(w.P_7 || ''),
        quantity: toNumber(w.P_8A) || 1,
        unit: UNIT_REVERSE_MAP[String(w.P_8B || '')] || String(w.P_8B || 'szt.'),
        unitPrice: toNumber(w.P_9A),
        vatRate: toNumber(w.P_12),
        netAmount,
        vatAmount,
        grossAmount: Math.round((netAmount + vatAmount) * 100) / 100,
      }
    })

  const netAmount = items.reduce((sum, item) => sum + item.netAmount, 0)
  const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0)
  const grossAmount = toNumber(fa.P_15) || Math.round((netAmount + vatAmount) * 100) / 100

  return {
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
