# Refactoring Plan — `refactor/codebase-improvements`

Based on a full codebase audit (2026-08-01). Branch from `main @ e2f354c`.
Totals at audit time: 14,852 lines TS/TSX across `app/` + `components/` + `lib/`; 22 API routes (2,085 lines).

Work in three phases. Commit after each numbered item; run `npm run build` + `npm run lint` before each commit.

---

## Phase 1 — Extract & Deduplicate

### 1.1 Adopt `lib/i18n/formatters.ts` (zero consumers today) ✅ high value / low risk

`formatCurrency`, `formatDate`, `formatNumber` etc. exist but are re-inlined in 8 files:

- `components/invoices/invoice-table.tsx`
- `components/invoices/invoice-detail-page.tsx`
- `components/invoices/ksef-invoice-view.tsx`
- `components/invoices/invoice-items-table.tsx`
- `components/invoices/invoice-stats.tsx`
- `components/invoices/export-button.tsx` (keep its CSV-specific `toFixed(2).replace('.', ',')` — that's a format contract, not display)
- `components/members/members-table.tsx`
- `components/company-settings/ksef-credentials-section.tsx` — **bug fix**: uses `toLocaleDateString()` with no locale

### 1.2 Deduplicate KSeF auth flow in `lib/ksef/auth.ts` (443 lines)

`authenticateWithKsef` and `authenticateWithCertificate` share ~130 near-identical lines.
Extract `pollAuthStatus(baseUrl, referenceNumber, bearer?)` and `redeemTokens(baseUrl, referenceNumber, bearer?)`.

### 1.3 Deduplicate certificate upload parsing

The form-data → validate → parse-PKCS12/PEM block is copy-pasted between:

- `app/api/companies/[companyId]/ksef-credentials/route.ts` (lines ~161–242)
- `app/api/companies/[companyId]/ksef-credentials/validate/route.ts` (lines ~185–257)

Extract `parseCertificateFormData(formData)` into `lib/ksef/`. Also: `VALID_ENVIRONMENTS` is declared 3×; derive from `KsefEnvironment` in `lib/ksef/types.ts`.

### 1.4 Fix cert-auth bug in status route + adopt `authenticateKsefClient` everywhere

- `app/api/invoices/[id]/ksef/status/route.ts` is token-only — certificate-auth companies get "KSeF token not configured". **Latent bug.** Use `authenticateKsefClient`.
- `validate/route.ts` re-derives `authenticateKsefClient` inline — replace.

### 1.5 Consistent API middleware + error shaping

- Migrate to `lib/api/middleware.ts` helpers: `app/api/gus/lookup/route.ts`, `app/api/invoices/[id]/items/route.ts`, `app/api/invoices/[id]/xml/route.ts` (currently returns a **different error shape** — string instead of `{code,message}`).
- Add `requireInvoiceAccess(invoiceId)` helper (fetch invoice → 404 → `requireMemberAuth(invoice.company_id)`); adopt in the 4 invoice sub-routes.
- Extract `toErrorMessage(err)` (the unknown→message ladder is written 4×) into `lib/api/` or `lib/utils/`.

### 1.6 Extract business logic from fat routes into `lib/`

56% of route code is in 5 files:

| Route                                      | Lines | Extract to                                                                                      |
| ------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------- |
| `ksef-credentials/route.ts`                | 384   | `lib/data/ksef-credentials.ts` (upsert, set-default-if-only) + `lib/ksef/certificate-upload.ts` |
| `ksef-credentials/validate/route.ts`       | 289   | `lib/ksef/validate-credential.ts`                                                               |
| `ksef/fetch/route.ts`                      | 184   | `lib/ksef/import-invoices.ts`                                                                   |
| `invoices/[id]/ksef/send/route.ts`         | 158   | `lib/ksef/send-invoice.ts`; move base64url SHA-256 to `lib/ksef/crypto.ts`                      |
| `ksef-credentials/[credentialId]/route.ts` | 148   | `lib/data/ksef-credentials.ts`                                                                  |

Also `app/api/invoices/route.ts`: move create-with-items (incl. compensating delete) to `lib/data/invoices.ts` — note the non-transactional insert is a correctness risk (consider RPC later).

### 1.7 Merge overlapping Zod schemas

`lib/validations/invoice.ts` vs `lib/validations/ksef-fa3.ts` duplicate item/invoice schemas; `app/api/invoices/route.ts` runs both back to back. Make `createInvoiceSchema` reuse the FA(3) base. Extract shared NIP normalization/validation (hand-rolled in 5+ places) into `lib/validations/`.

### 1.8 Deduplicate customers ↔ vendors (~2,000 lines, ~95% identical) — biggest single win

Every layer is a copy-paste pair: API routes (3 pairs), `lib/data/customers.ts`/`vendors.ts`, 6 component pairs, settings pages. Parameterize by `entity: 'customer' | 'vendor'` following the existing precedent (`sales`/`purchases` pages delegating to `InvoiceListPage`).

### 1.9 Extract server-page auth preamble

`createClient → getUser → redirect('/login') → getUserCompanies → redirect('/onboarding') → getDefaultCompanyId` is repeated 6× verbatim. Extract `requirePageCompanyContext()`.

---

## Phase 2 — UI Component Library

`components/ui/` (8 shadcn-style primitives) exists but only 5 feature files use it; `input.tsx`, `card.tsx`, `select.tsx`, `tooltip.tsx` have zero consumers.

- **2.1** Adopt `Button` (37 files use raw `<button>`; ~10 ad-hoc spellings of the same primary button) and `Input` (identical 10×-repeated class string; `invoice-form.tsx` has its own `inputBase`/`inputError` constants).
- **2.2** Add missing primitives: `Label` (20× repeated class), `FormField` (label+input+error), `Alert` (~8 files), `EmptyState`, `Spinner`, `ConfirmDialog` (delete-confirm in 5 places).
- **2.3** Replace hand-rolled modal in `ksef-preview-modal.tsx` with `ui/dialog.tsx`; adopt `ui/table.tsx` in the 6 raw-table files.
- **2.4** Split oversized components:
  - `ksef-add-credential-modal.tsx` (605 lines, 11 useState, 4-step wizard) → step components + `useCredentialWizard` hook
  - `invoice-form.tsx` (593) → item-table subcomponent + validation hook
  - `ksef-credentials-section.tsx` (357) → table + actions hook

---

## Phase 3 — Documentation & logging hygiene

- **3.1** JSDoc for the most-imported undocumented modules: `lib/api/middleware.ts` (7 exports, used by 18 routes), all of `lib/data/` (27 exports — document RLS assumptions, server-only status, pagination), `lib/ksef/api-client.ts` (13 public methods), `lib/gus/`.
- **3.2** Point FA(3) builder/parser code at `docs/ksef/FA3_FIELD_MAPPING.md` with file-level doc blocks.
- **3.3** Logging hygiene: 72 `console.log` in `lib/ksef/` (auth.ts 34, fa3-xml-parser.ts 21, api-client.ts 13) — several print token prefixes and full challenge/redeem response bodies (**secret leakage**). Replace with a minimal debug logger gated by env var; never log token material.

---

## Phase 4 — FA(3) builder field-mapping defects

Found 2026-08-01 while adding the Phase 3.2 doc blocks, by cross-checking
`lib/ksef/fa3-xml-builder.ts` against `docs/ksef/FA3_FIELD_MAPPING.md` and
`docs/ksef/schemat_FA(3)_v1-0E.xsd`. Both are currently recorded in `@remarks` in the
builder and **not fixed** — they change what is transmitted to KSeF, so they were kept out
of a documentation-only PR.

**This is a correctness phase, not a refactor.** It affects invoices filed with the Polish
tax authority. Treat the XSD as authoritative, and confirm the intended pricing mode
(below) before changing any emission.

### 4.1 `P_11A` carries the VAT amount, but the field means gross

`lib/ksef/fa3-xml-builder.ts:120`:

```ts
<P_11A>${formatAmount(item.vat_amount)}</P_11A>   // writes VAT into a gross field
```

Evidence:

- XSD annotation for `P_11A`: _"Wartość sprzedaży brutto"_ (gross sales value).
- `FA3_FIELD_MAPPING.md` line ~155: `P_11A` → `gross_amount`, "Gross line total".
- `lib/ksef/fa3-xml-parser.ts` reads `P_11A` as `grossAmount`.

So an invoice Filbert builds and then reads back through its own parser derives the wrong
gross. `P_11Vat` — where the VAT line total belongs — is never emitted at all.

**Caveat to resolve first.** Both `P_11A` and `P_11Vat` are `minOccurs="0"`, and the XSD's
annotation for `P_11Vat` appears to be copy-pasted from `P_11A` (identical text), so the
schema alone does not settle which field holds VAT. The mapping doc and the parser agree it
is `P_11Vat`; confirm against the official FA(3) specification before relying on it.
The builder emits `P_9A`/`P_11` (net pricing mode), and `P_11A` is documented as applying
"w przypadku zastosowania art. 106e ust. 7 i 8" — the gross-pricing case — so **dropping
`P_11A` entirely may be more correct than populating it.** Decide between:

- (a) emit `P_11Vat` with `vat_amount` and drop `P_11A`, or
- (b) emit `P_11A` with the line's gross and `P_11Vat` with the VAT.

### 4.2 The VAT summary always uses the 23% band, and misuses `P_14_1W`

`lib/ksef/fa3-xml-builder.ts:127–132` groups items by VAT rate, then emits the **same three
elements for every group**:

```ts
<P_13_1>{net}</P_13_1>      // P_13_1 is specifically the standard rate
<P_14_1>{vat}</P_14_1>      // P_14_1 likewise
<P_14_1W>{rate}</P_14_1W>   // a rate integer written into a monetary field
```

Three distinct problems:

1. **Wrong band.** Per the XSD, `P_13_1`/`P_14_1` are the standard rate (23%/22%),
   `P_13_2`/`P_14_2` the first reduced rate (8%/7%), `P_13_3`/`P_14_3` the second (5%).
   A single-rate 8% invoice is currently filed as though it were 23%.
2. **Schema-invalid when multi-rate.** Neither `P_13_1` nor `P_14_1` declares `maxOccurs`,
   so each may appear **at most once**. An invoice spanning two VAT rates emits the pair
   twice and should be rejected by schema validation — meaning multi-rate invoices likely
   cannot be sent at all today, rather than being filed with wrong figures. Worth
   confirming against a real send, since it determines whether this is a silent-corruption
   bug or a hard blocker.
3. **`P_14_1W` misused.** It is `TKwotowy` (a monetary amount) and means the standard-rate
   VAT _converted to PLN when the invoice is issued in a foreign currency_ — not a rate
   label. The builder writes `"23"`/`"8"` into it. It is `minOccurs="0"`; for PLN invoices
   it should simply be omitted.

**Fix shape:** map each VAT rate to its band index (23→`_1`, 8→`_2`, 5→`_3`, 0→the
zero-rate/exempt fields — check the XSD for which), emit each band at most once, and drop
`P_14_1W` unless `invoice.currency !== 'PLN'`.

### 4.3 Verification

Neither defect is currently covered by a test — which is why both survived.

- Add round-trip tests: `buildFA3Xml` → `parseFA3Xml` → assert net/VAT/gross and per-item
  amounts match the source invoice. This would have caught 4.1 directly.
- Add a multi-rate fixture (23% + 8% + 5% lines) and a single-rate non-23% fixture.
- Validate builder output against `docs/ksef/schemat_FA(3)_v1-0E.xsd` in a test — this is
  the check that catches 4.2 and any future field misuse. `lib/ksef/fa3-validator.ts`
  validates the _input_ shape via Zod, not the emitted XML, so it does not cover this.
- Send one invoice per rate configuration to the KSeF **test** environment before
  considering the phase done.

### 4.4 Then update the docs

Once fixed, remove the `@remarks` blocks from `lib/ksef/fa3-xml-builder.ts` and, if the
mapping table needs correcting, update `docs/ksef/FA3_FIELD_MAPPING.md` — its "Line Items"
and "Building XML" sections both describe the intended behaviour rather than the current
behaviour.

---

## Progress

- [x] 1.1 formatters adoption
- [x] 1.2 auth.ts dedup
- [x] 1.3 certificate upload parsing
- [x] 1.4 status-route cert bug + authenticate-client adoption
- [x] 1.5 middleware consistency
- [x] 1.6 fat-route extraction
- [x] 1.7 Zod schema merge (NIP helper adoption in customers/vendors routes lands with 1.8)
- [x] 1.8 customers/vendors dedup
- [x] 1.9 page preamble helper
- [x] Phase 2
  - [x] 2.1 `Button` + `Input` adoption
  - [x] 2.2 missing primitives (Label, FormField, Alert, EmptyState, Spinner, ConfirmDialog)
  - [x] 2.3 dialog + table primitive adoption
  - [x] 2.4 split oversized components
- [x] Phase 3
  - [x] 3.1 JSDoc for most-imported modules (`lib/api/middleware.ts`, all of `lib/data/`, `lib/ksef/api-client.ts`, `lib/gus/`)
  - [x] 3.2 FA(3) builder/parser file-level doc blocks (point at `docs/ksef/FA3_FIELD_MAPPING.md`)
  - [x] 3.3 logging hygiene (`lib/ksef/logger.ts`, gated by `KSEF_DEBUG`)
- [ ] Phase 4 — FA(3) builder field-mapping defects (**correctness; affects filed invoices**)
  - [ ] 4.1 `P_11A` / `P_11Vat` — resolve pricing mode, then fix emission
  - [ ] 4.2 VAT summary bands + `P_14_1W` misuse
  - [ ] 4.3 round-trip + XSD-validation tests, test-environment send
  - [ ] 4.4 remove the `@remarks` blocks and correct `FA3_FIELD_MAPPING.md`
