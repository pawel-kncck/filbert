/**
 * Builds FA(3) invoice XML for submission to KSeF.
 *
 * **Field reference: `docs/ksef/FA3_FIELD_MAPPING.md`.** FA(3) names every
 * field positionally (`P_7`, `P_11`, `P_13_1`…), so the element names here mean
 * nothing on their own — consult that document before adding or changing one.
 * It records the full element↔column mapping, the unit and VAT-rate code
 * tables, and the decimal/escaping rules. The authoritative schema is
 * `docs/ksef/schemat_FA(3)_v1-0E.xsd`; `lib/ksef/fa3-xml-parser.ts` reads the
 * same format back, and `lib/validations/ksef-fa3.ts` validates it.
 *
 * XML is assembled by string interpolation rather than a DOM: the document is
 * small and fixed-shape. Every interpolated string must go through
 * {@link escapeXml} and every amount through {@link formatAmount} — invoice
 * descriptions and company names routinely contain `&`.
 *
 * @remarks Two known deviations from the mapping document, both affecting what
 *   is transmitted. Recorded here rather than silently corrected, because
 *   changing what is filed with the tax authority warrants its own reviewed
 *   change:
 *
 *   1. `P_11A` is emitted with the line's **VAT** amount, but FA(3) defines it
 *      as the line's **gross** total (FA3_FIELD_MAPPING.md, "Line Items"), and
 *      the parser reads it as gross. The VAT line total belongs in `P_11Vat`,
 *      which is never emitted. An invoice built here and read back by our own
 *      parser therefore derives the wrong gross.
 *   2. The VAT summary always writes the `P_13_1` / `P_14_1` pair, which is
 *      specifically the 23% band. An invoice spanning several VAT rates emits
 *      that pair repeatedly instead of using `P_13_2`/`P_14_2` (8%),
 *      `P_13_3`/`P_14_3` (5%) and so on, so the summary is wrong for any
 *      multi-rate invoice and mislabels single-rate invoices below 23%.
 */
import type { Invoice, InvoiceItem } from '@/lib/types/database'

/**
 * Escapes the five XML predefined entities.
 *
 * Required on every interpolated string — see the module note.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Formats an amount as FA(3) requires: exactly 2 decimals, `.` separator. */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Polish VAT rates to their FA(3) codes. Unmapped rates fall back to the
 * stringified number.
 */
const VAT_RATE_MAP: Record<number, string> = {
  23: '23',
  8: '8',
  5: '5',
  0: '0',
}

/**
 * App unit labels to UN/ECE Recommendation 20 codes, which FA(3) requires.
 * `fa3-xml-parser.ts` holds the reverse map. Unknown units fall back to `C62`
 * (piece).
 */
const UNIT_MAP: Record<string, string> = {
  'szt.': 'C62',
  'godz.': 'HUR',
  kg: 'KGM',
  m: 'MTR',
  'm²': 'MTK',
  'usł.': 'C62',
}

/**
 * Renders an invoice and its line items as an FA(3) XML document.
 *
 * Line items become `FaWiersz` elements and are additionally aggregated by VAT
 * rate into the `P_13_*` / `P_14_*` summary — see the module `@remarks` for a
 * known defect in that aggregation.
 *
 * @param params.invoice The invoice header; supplies the parties, dates,
 *   currency and the `P_15` gross total.
 * @param params.items Line items, in `position` order.
 * @param params.vendorAddress Seller address as a single line (`AdresL1`).
 *   Omitted renders as empty, which KSeF may reject — pass it for real sends.
 * @returns The XML document, ready for `KsefApiClient.sendInvoice`.
 */
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
