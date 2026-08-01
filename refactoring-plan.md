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
- [ ] Phase 2
  - [x] 2.1 `Button` + `Input` adoption
  - [x] 2.2 missing primitives (Label, FormField, Alert, EmptyState, Spinner, ConfirmDialog)
  - [x] 2.3 dialog + table primitive adoption
  - [ ] 2.4 split oversized components
- [ ] Phase 3
