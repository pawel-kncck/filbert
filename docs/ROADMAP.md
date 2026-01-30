# Filbert Implementation Roadmap

A comprehensive implementation plan for Filbert - a KSeF (Polish e-invoicing system) invoice management application.

---

## Completed Phases

### Phase 1: Auth + Company + Database Schema

- Supabase setup with @supabase/ssr
- Email/password authentication (login, signup, forgot/reset password)
- Company creation with NIP validation
- Pending user flow (admin approval required for existing companies)
- Demo company with sample data
- RLS policies with SECURITY DEFINER helper function

### Phase 2: App Shell + Invoice Lists + Company Selector

- Fixed sidebar navigation (240px)
- Top bar with company selector and logout
- Invoice tables for sales and purchases
- Company switching via URL params
- Invoice statistics cards

### Phase 3: Invoice Features

- Search filtering (vendor/customer name, invoice number)
- Date range picker
- Pagination (25 items per page)
- CSV export with Polish formatting
- Invoice detail pages (/sales/[id], /purchases/[id])

### Phase 4: Admin Features

- Member management page (/settings/members)
- Approve/reject pending member requests
- Change member roles (admin/member/viewer)
- Remove members (with last-admin protection)
- Settings section in sidebar

### Phase 4.5: Internationalization (i18n)

- next-intl library for Next.js App Router
- Polish (default) and English language support
- Hybrid URL strategy: prefix routing for landing page, cookie-based for protected routes
- Language switcher in header and top bar
- Translation files: messages/pl.json, messages/en.json
- Validation script: `npm run i18n:validate`

### Phase 5: Contacts & Invoice Management

- **5a: Vendors List** — CRUD vendor contacts with sync from purchase invoices, search/pagination, missing vendors alert
- **5b: Customers List** — CRUD customer contacts with sync from sales invoices, "Create invoice" action linking to `/sales/new?customer=`
- **5c: Invoice Items** — `invoice_items` table with RLS, display on invoice detail pages, currency-formatted totals
- **5d: Create Sales Invoice** — `/sales/new` form with dynamic line items, copy invoice flow, customer prefill, auto-calculated amounts
- **5e: FA(3) Schema Validation** — KSeF FA(3) Zod schema with field-level inline errors, server-side validation (HTTP 422), translation message keys
- **5f: KSeF Invoice Preview** — Styled A4-like preview modal with QR code (KOD I), `ksef_hash` column, preview button on table and detail page
- **5g: Sidebar & Translation Updates** — Navigation entries for all Phase 5 features, 350+ translation keys (PL + EN)

### Phase 7: Company Settings

- Company settings page at `/settings/company`
- Edit company name (admin only, inline editing)
- View NIP (read-only for all users)
- KSeF credentials management (token + environment: test/demo/prod, admin only)
- Delete company with name-typing confirmation dialog (cascade delete, admin only)
- Sidebar navigation entry with gear icon
- Demo company shows unavailable message
- Non-admin users see read-only view

### Phase 8: KSeF Integration

- KSeF API client for test/demo/prod environments
- Send sales invoices to KSeF (FA(3) XML generation, session management, status polling)
- Fetch invoices from KSeF (query by date range, parse FA(3) XML, import with deduplication)
- Invoice KSeF status tracking (pending → sent → accepted/rejected/error)
- KSeF status badges on invoice table and detail pages
- "Send to KSeF" button on sales invoice detail page
- "Fetch from KSeF" section in company settings (admin only)
- Error handling with user-friendly messages (auth failures, session errors, connection issues)
- SHA-256 hash generation for QR code after successful send
- Database columns: ksef_status, ksef_error, ksef_sent_at

### Phase 11: GUS REGON API Connector

- **11a: GUS Client Library** — `lib/gus/` with SOAP client, XML parsing (fast-xml-parser), session management, in-memory cache (24h TTL)
- **11b: Environment & API Route** — `GUS_API_KEY` + `GUS_ENVIRONMENT` env vars, `GET /api/gus/lookup?nip=` endpoint with auth + rate limiting (10/min)
- **11c: Frontend Hook & Component** — `useNipLookup` hook + `NipLookupButton` component with i18n error keys
- **11d: Integration Points** — NIP lookup button on onboarding page, vendor form dialog, and customer form dialog
- **11e: Translations** — `gus` namespace in PL + EN with lookup, loading, error, and status messages

---

## Upcoming Phases

### Phase 10: Single-Record Invoice Model

Refactor the invoice schema from per-company duplicated records to a single-record model where each invoice exists once in the database with references to both the seller and buyer company. This eliminates data duplication and enables automatic cross-company invoice visibility (e.g., a sales invoice issued by one demo company appears as a purchase invoice for the receiving demo company).

#### 10a: Database Migration

**Migration** (`supabase/migrations/..._single_record_invoices.sql`):

- Add `seller_company_id UUID REFERENCES companies(id)` (nullable)
- Add `buyer_company_id UUID REFERENCES companies(id)` (nullable)
- Add CHECK constraint: `seller_company_id IS NOT NULL OR buyer_company_id IS NOT NULL`
- Migrate existing data:
  - `type = 'sales'` → set `seller_company_id = company_id`
  - `type = 'purchase'` → set `buyer_company_id = company_id`
- Cross-link demo companies: where `vendor_nip` or `customer_nip` matches a known company NIP, set the corresponding `seller_company_id` or `buyer_company_id`
- Drop column `type` (derived from perspective: seller_company_id = my company → sales, buyer_company_id = my company → purchase)
- Drop column `company_id`
- Update indexes: replace `(company_id, type)` index with separate indexes on `seller_company_id` and `buyer_company_id`
- Update unique constraint: replace `(company_id, invoice_number)` with `(seller_company_id, invoice_number) WHERE seller_company_id IS NOT NULL`

**RLS policies** (`supabase/rls-policies.sql`):

- Update SELECT policy: allow if `seller_company_id` or `buyer_company_id` is in user's active companies or is a demo company
- Update INSERT policy: allow if `seller_company_id` is in user's admin/member companies (only sellers create invoices)

**SQL functions** (`supabase/migrations/...`):

- `get_missing_vendors(p_company_id)` → filter by `buyer_company_id = p_company_id` instead of `company_id = ... AND type = 'purchase'`
- `get_missing_customers(p_company_id)` → filter by `seller_company_id = p_company_id` instead of `company_id = ... AND type = 'sales'`
- Same for `_count` variants

#### 10b: Type Definitions & Data Layer

**TypeScript types** (`lib/types/database.ts`):

- Replace `company_id` with `seller_company_id` and `buyer_company_id` (both `string | null`)
- Remove `type` field from `Invoice`, `InvoiceInsert`, `InvoiceUpdate`

**Data fetching** (`lib/data/invoices.ts`):

- `getInvoices(companyId, type)`:
  - `type = 'sales'` → `.eq('seller_company_id', companyId)`
  - `type = 'purchase'` → `.eq('buyer_company_id', companyId)`
  - Also include cross-company invoices: a sales invoice from another company where `buyer_company_id = companyId` should show under purchases
- `getInvoiceById(id, companyId)`: verify `seller_company_id = companyId OR buyer_company_id = companyId`
- `getAllInvoicesForExport()`: same pattern as `getInvoices`

#### 10c: API Routes

**Invoice creation** (`app/api/invoices/route.ts`):

- Set `seller_company_id` instead of `company_id` + `type: 'sales'`
- Remove `type` from insert payload
- Cross-link: if `customer_nip` matches a company in our system, set `buyer_company_id` to that company's ID

**KSeF send** (`app/api/invoices/[id]/ksef/send/route.ts`):

- Validate `invoice.seller_company_id === companyId` instead of `invoice.type === 'sales'`

**KSeF fetch** (`app/api/companies/[companyId]/ksef/fetch/route.ts`):

- Sales fetch: set `seller_company_id = companyId`, cross-link `buyer_company_id` if customer NIP matches a known company
- Purchase fetch: set `buyer_company_id = companyId`, cross-link `seller_company_id` if vendor NIP matches a known company
- Deduplication: before inserting, check if an invoice with the same `ksef_reference` already exists (it may have been fetched by the counterparty already) — if so, update the existing record to set the missing company_id

#### 10d: Components

Most components receive `type` as a prop from the URL route (`/sales` vs `/purchases`), so the interface stays the same. Changes needed:

- `invoice-detail-page.tsx`: replace `invoice.type !== type` guard with check on `seller_company_id`/`buyer_company_id` matching current company
- `invoice-table.tsx`: no `invoice.type` references to update (already uses prop-based `type`)
- `ksef-send-button.tsx`: check `invoice.seller_company_id` instead of `invoice.type === 'sales'`
- `invoice-form.tsx`: no changes (already creates sales invoices only)
- `export-button.tsx`: no changes (already uses prop-based `type`)

#### 10e: Seed Data

**Rewrite** `supabase/seed-demo-invoices.sql`:

- **Cross-company invoices** (single record, both FKs set):
  - Demo Sp. z o.o. → Demo Klient: `seller_company_id = demo_sp`, `buyer_company_id = demo_klient`, same invoice number/date/amount visible from both sides
  - Demo Dostawca → Demo Sp. z o.o.: `seller_company_id = demo_dostawca`, `buyer_company_id = demo_sp`
  - Demo Dostawca → Demo Klient: `seller_company_id = demo_dostawca`, `buyer_company_id = demo_klient`
- **External invoices** (one FK set, counterparty is text-only):
  - Sales to external companies: `seller_company_id` set, `buyer_company_id` null
  - Purchases from external vendors: `buyer_company_id` set, `seller_company_id` null

#### 10f: Validation & Translation Updates

- Update `createInvoiceSchema` (`lib/validations/invoice.ts`): remove `company_id`, add `seller_company_id`
- Update i18n validation script if it references invoice type fields
- No translation key changes needed (sales/purchase distinction is URL-based, not data-based)

---

## Future Phases (Non-essential)

### Phase 6: Dashboard & Analytics

- Summary cards (total invoices, revenue, expenses, balance)
- Monthly trends chart (line/bar)
- Top 5 vendors by purchase amount
- Top 5 customers by sales amount
- Period selector (this month, last 3 months, this year, custom)

### Phase 9: Notifications & Audit

- Email notifications (new member request, approval/rejection)
- In-app notification bell
- Audit log (invoice CRUD, member changes, settings changes)

---

## Infrastructure & Quality

### CI/CD Pipeline (Planned)

- GitHub Actions workflow with: `npm run lint`, `tsc --noEmit`, `npm run build`, `npm test`
- Preview deployments via Vercel
- Branch protection rules on `main`

---

## Implementation Guidelines

### General Rules

- Run `npm run build` and `npm run lint` before committing
- Run `npm run i18n:validate` after adding translations
- Commit frequently with descriptive messages
- Follow existing component patterns (zinc colors, dark mode)
- All UI text must be internationalized (PL + EN)

### Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Auth + PostgreSQL)
- @supabase/ssr for SSR support
- next-intl for internationalization

### Path Aliases

- `@/*` maps to project root
- Example: `import { createClient } from '@/lib/supabase/server'`

### Data Layer Pattern

```typescript
// Server Component
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('namespace')
  // fetch data with server-side Supabase client
}

// Client Component
;('use client')
import { useTranslations } from 'next-intl'

export function Component() {
  const t = useTranslations('namespace')
  // use client-side hooks
}
```
