import type { Invoice, InvoiceItem } from '@/lib/types/database'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

const VAT_RATE_MAP: Record<number, string> = {
  23: '23',
  8: '8',
  5: '5',
  0: '0',
}

const UNIT_MAP: Record<string, string> = {
  'szt.': 'C62',
  'godz.': 'HUR',
  kg: 'KGM',
  m: 'MTR',
  'm²': 'MTK',
  'usł.': 'C62',
}

export function buildFA3Xml(params: {
  invoice: Invoice
  items: InvoiceItem[]
  vendorAddress?: string
}): string {
  const { invoice, items, vendorAddress } = params
  const now = new Date().toISOString()

  // Group items by VAT rate for summary rows
  const vatGroups = new Map<number, { net: number; vat: number }>()
  for (const item of items) {
    const existing = vatGroups.get(item.vat_rate) || { net: 0, vat: 0 }
    existing.net += item.net_amount
    existing.vat += item.vat_amount
    vatGroups.set(item.vat_rate, existing)
  }

  const itemsXml = items
    .map(
      (item) => `
      <FaWiersz>
        <NrWierszaFa>${item.position}</NrWierszaFa>
        <P_7>${escapeXml(item.description)}</P_7>
        <P_8A>${item.quantity}</P_8A>
        <P_8B>${UNIT_MAP[item.unit] || 'C62'}</P_8B>
        <P_9A>${formatAmount(item.unit_price)}</P_9A>
        <P_11>${formatAmount(item.net_amount)}</P_11>
        <P_11A>${formatAmount(item.vat_amount)}</P_11A>
        <P_12>${VAT_RATE_MAP[item.vat_rate] || String(item.vat_rate)}</P_12>
      </FaWiersz>`
    )
    .join('')

  const vatSummaryXml = Array.from(vatGroups.entries())
    .map(
      ([rate, amounts]) => `
      <P_13_1>${formatAmount(amounts.net)}</P_13_1>
      <P_14_1>${formatAmount(amounts.vat)}</P_14_1>
      <P_14_1W>${VAT_RATE_MAP[rate] || String(rate)}</P_14_1W>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${now}</DataWytworzeniaFa>
    <SystemInfo>Filbert</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${escapeXml(invoice.vendor_nip || '')}</NIP>
      <Nazwa>${escapeXml(invoice.vendor_name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${escapeXml(vendorAddress || '')}</AdresL1>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      ${invoice.customer_nip ? `<NIP>${escapeXml(invoice.customer_nip)}</NIP>` : ''}
      <Nazwa>${escapeXml(invoice.customer_name)}</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot2>
  <Fa>
    <KodWaluty>${escapeXml(invoice.currency)}</KodWaluty>
    <P_1>${escapeXml(invoice.issue_date)}</P_1>
    <P_2>${escapeXml(invoice.invoice_number)}</P_2>
    <P_15>${formatAmount(invoice.gross_amount)}</P_15>
    ${vatSummaryXml}
    ${itemsXml}
  </Fa>
</Faktura>`
}
