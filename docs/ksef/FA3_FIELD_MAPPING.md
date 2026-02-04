# FA(3) Invoice XML Field Mapping

This document maps the FA(3) XML fields to Filbert's data model. Use this as a quick reference when working with KSeF invoice XML.

---

## XML Structure Overview

```xml
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>...</Naglowek>     <!-- Header -->
  <Podmiot1>...</Podmiot1>     <!-- Seller -->
  <Podmiot2>...</Podmiot2>     <!-- Buyer -->
  <Fa>...</Fa>                 <!-- Invoice data -->
</Faktura>
```

---

## Header (Naglowek)

```xml
<Naglowek>
  <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
  <WariantFormularza>3</WariantFormularza>
  <DataWytworzeniaFa>2024-02-01T10:00:00Z</DataWytworzeniaFa>
  <SystemInfo>Filbert</SystemInfo>
</Naglowek>
```

| Field               | Value         | Notes             |
| ------------------- | ------------- | ----------------- |
| `KodFormularza`     | `FA`          | Fixed             |
| `kodSystemowy`      | `FA (3)`      | Schema identifier |
| `wersjaSchemy`      | `1-0E`        | Schema version    |
| `WariantFormularza` | `3`           | Fixed for FA(3)   |
| `DataWytworzeniaFa` | ISO timestamp | Generation time   |
| `SystemInfo`        | `Filbert`     | System name       |

---

## Seller (Podmiot1)

```xml
<Podmiot1>
  <DaneIdentyfikacyjne>
    <NIP>1234567890</NIP>
    <Nazwa>Company Name Sp. z o.o.</Nazwa>
  </DaneIdentyfikacyjne>
  <Adres>
    <KodKraju>PL</KodKraju>
    <AdresL1>ul. Example 1, 00-001 Warsaw</AdresL1>
  </Adres>
</Podmiot1>
```

| Field      | Filbert Field | Notes               |
| ---------- | ------------- | ------------------- |
| `NIP`      | Company NIP   | Required, 10 digits |
| `Nazwa`    | Company name  | Required            |
| `KodKraju` | -             | Always `PL`         |
| `AdresL1`  | -             | Free-form address   |

---

## Buyer (Podmiot2)

```xml
<Podmiot2>
  <DaneIdentyfikacyjne>
    <NIP>0987654321</NIP>    <!-- Optional -->
    <Nazwa>Customer Name</Nazwa>
  </DaneIdentyfikacyjne>
</Podmiot2>
```

| Field   | Filbert Field   | Notes    |
| ------- | --------------- | -------- |
| `NIP`   | `customer_nip`  | Optional |
| `Nazwa` | `customer_name` | Required |

---

## Invoice Data (Fa)

### Core Fields

```xml
<Fa>
  <KodWaluty>PLN</KodWaluty>
  <P_1>2024-02-01</P_1>
  <P_2>FV/2024/001</P_2>
  ...
</Fa>
```

| XML Field   | Filbert Field    | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `KodWaluty` | `currency`       | ISO 4217 code (default: PLN) |
| `P_1`       | `issue_date`     | Invoice date (YYYY-MM-DD)    |
| `P_2`       | `invoice_number` | Invoice number               |

### Amount Summary Fields

```xml
<Fa>
  <P_13_1>1000.00</P_13_1>   <!-- Net at 23% -->
  <P_14_1>230.00</P_14_1>    <!-- VAT at 23% -->
  <P_14_1W>23</P_14_1W>      <!-- Rate label -->
  <P_15>1230.00</P_15>       <!-- Gross total -->
</Fa>
```

| XML Field  | Description     | VAT Rate          |
| ---------- | --------------- | ----------------- |
| `P_13_1`   | Net amount      | 23%               |
| `P_13_2`   | Net amount      | 8%                |
| `P_13_3`   | Net amount      | 5%                |
| `P_13_4`   | Net amount      | 0%                |
| `P_13_6_1` | Net amount      | Exempt (zw.)      |
| `P_13_7`   | Net amount      | Not subject (np.) |
| `P_14_1`   | VAT amount      | 23%               |
| `P_14_2`   | VAT amount      | 8%                |
| `P_14_3`   | VAT amount      | 5%                |
| `P_14_4`   | VAT amount      | 0%                |
| `P_14_5`   | VAT amount      | Special           |
| `P_15`     | **Gross total** | All rates         |

---

## Line Items (FaWiersz)

```xml
<FaWiersz>
  <NrWierszaFa>1</NrWierszaFa>
  <P_7>Service description</P_7>
  <P_8A>2</P_8A>
  <P_8B>C62</P_8B>
  <P_9A>100.00</P_9A>
  <P_11>200.00</P_11>
  <P_11Vat>46.00</P_11Vat>
  <P_12>23</P_12>
</FaWiersz>
```

| XML Field     | Filbert Field  | Description                           |
| ------------- | -------------- | ------------------------------------- |
| `NrWierszaFa` | `position`     | Row number (1-based)                  |
| `P_7`         | `description`  | Item description                      |
| `P_8A`        | `quantity`     | Quantity                              |
| `P_8B`        | `unit`         | Unit code (see below)                 |
| `P_9A`        | `unit_price`   | Unit price (net)                      |
| `P_9B`        | -              | Unit price (gross, for gross pricing) |
| `P_11`        | `net_amount`   | Net line total                        |
| `P_11A`       | `gross_amount` | Gross line total (gross pricing mode) |
| `P_11Vat`     | `vat_amount`   | VAT line total                        |
| `P_12`        | `vat_rate`     | VAT rate (23, 8, 5, 0, zw, np)        |

### Unit Codes

| Code  | Polish | English      |
| ----- | ------ | ------------ |
| `C62` | szt.   | piece        |
| `HUR` | godz.  | hour         |
| `KGM` | kg     | kilogram     |
| `MTR` | m      | meter        |
| `MTK` | m²     | square meter |

---

## Parsing Notes

### Amount Calculation Logic

When parsing XML, amounts may be missing. Use this fallback logic:

```typescript
// 1. Try direct fields
let net = P_11
let gross = P_11A
let vat = P_11Vat

// 2. Calculate from unit price if missing
if (net === 0 && P_9A) {
  net = P_9A * quantity
}
if (gross === 0 && P_9B) {
  gross = P_9B * quantity
}

// 3. Calculate VAT from net and rate
if (net > 0 && vat === 0 && vatRate > 0) {
  vat = net * (vatRate / 100)
}

// 4. Calculate net from gross (gross pricing mode)
if (gross > 0 && net === 0 && vatRate > 0) {
  net = gross / (1 + vatRate / 100)
  vat = gross - net
}

// 5. Calculate gross from net + vat
if (gross === 0) {
  gross = net + vat
}
```

### Summary vs Line Item Totals

- **Prefer summary fields** (`P_13_*`, `P_14_*`, `P_15`) as official totals
- **Fall back to line item sums** only if summary is 0

```typescript
const netFromSummary = P_13_1 + P_13_2 + P_13_3 + P_13_4 + ...
const vatFromSummary = P_14_1 + P_14_2 + P_14_3 + P_14_4 + ...

const netAmount = netFromSummary > 0 ? netFromSummary : sumOfLineNets
const vatAmount = vatFromSummary > 0 ? vatFromSummary : sumOfLineVats
const grossAmount = P_15 || (netAmount + vatAmount)
```

---

## Building XML

### Escape Special Characters

XML content must escape special characters:

```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
```

### Format Decimals

Use 2 decimal places with dot separator:

```typescript
amount.toFixed(2) // "1234.56"
```

### VAT Rate Grouping

Group line items by VAT rate for summary:

```typescript
const byRate = items.reduce((acc, item) => {
  const rate = item.vatRate
  if (!acc[rate]) acc[rate] = { net: 0, vat: 0 }
  acc[rate].net += item.netAmount
  acc[rate].vat += item.vatAmount
  return acc
}, {})
```

---

## Codebase Reference

| Task              | File                                |
| ----------------- | ----------------------------------- |
| Build invoice XML | `lib/ksef/fa3-xml-builder.ts`       |
| Parse invoice XML | `lib/ksef/fa3-xml-parser.ts`        |
| Validate invoice  | `lib/validations/ksef-fa3.ts`       |
| XSD schema        | `docs/ksef/schemat_FA(3)_v1-0E.xsd` |

---

## Common Issues

### Issue: Net amount is 0

**Cause:** Invoice uses gross pricing mode (P_9B, P_11A instead of P_9A, P_11)

**Solution:** Check P_11A (gross) and calculate net from VAT rate

### Issue: VAT amount missing

**Cause:** P_11Vat not provided in XML

**Solution:** Calculate from net × (rate / 100)

### Issue: Summary doesn't match items

**Cause:** Rounding differences

**Solution:** Trust summary fields (P*13*_, P*14*_) over item calculations
