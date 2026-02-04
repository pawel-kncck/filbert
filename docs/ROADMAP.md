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
- Company switching via React Context + cookies
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
- KSeF credentials management (token + certificate + environment: test/demo/prod)
- Delete company with name-typing confirmation dialog (cascade delete, admin only)
- Sidebar navigation entry with gear icon
- Demo company shows unavailable message
- Non-admin users see read-only view

### Phase 8: KSeF Integration

- KSeF v2 API client for test/demo/prod environments
- Token authentication with RSA-OAEP encryption (challenge-response)
- Certificate authentication with XAdES-BES signatures
- PEM and PKCS#12 certificate format support
- Send sales invoices to KSeF (FA(3) XML generation, session management, status polling)
- Fetch invoices from KSeF (query by date range, parse FA(3) XML, import with deduplication)
- Invoice KSeF status tracking (pending → sent → accepted/rejected/error)
- KSeF status badges on invoice table and detail pages
- Raw XML storage and viewer for debugging
- "Send to KSeF" button on sales invoice detail page
- "Fetch from KSeF" section in company settings (admin only)
- Error handling with user-friendly messages

### Phase 11: GUS REGON API Connector

- **11a: GUS Client Library** — `lib/gus/` with SOAP client, XML parsing (fast-xml-parser), session management, in-memory cache (24h TTL)
- **11b: Environment & API Route** — `GUS_API_KEY` + `GUS_ENVIRONMENT` env vars, `GET /api/gus/lookup?nip=` endpoint with auth + rate limiting (10/min)
- **11c: Frontend Hook & Component** — `useNipLookup` hook + `NipLookupButton` component with i18n error keys
- **11d: Integration Points** — NIP lookup button on onboarding page, vendor form dialog, and customer form dialog
- **11e: Translations** — `gus` namespace in PL + EN with lookup, loading, error, and status messages

---

## Upcoming Phases

### Phase 10: Single-Record Invoice Model

Refactor the invoice schema from per-company duplicated records to a single-record model where each invoice exists once in the database with references to both the seller and buyer company.

**Benefits:**

- Eliminates data duplication
- Enables automatic cross-company invoice visibility
- A sales invoice from Company A to Company B automatically appears in B's purchases

**Key Changes:**

1. **Database Migration**
   - Add `seller_company_id` and `buyer_company_id` columns (nullable)
   - Migrate existing data based on `type` field
   - Cross-link demo companies by matching NIP
   - Drop `type` and `company_id` columns
   - Update RLS policies for dual-company access

2. **Type Definitions**
   - Replace `company_id` with `seller_company_id` / `buyer_company_id`
   - Remove `type` field (derived from perspective)

3. **Data Layer**
   - Update queries to filter by `seller_company_id` or `buyer_company_id`
   - Cross-link on invoice creation when counterparty NIP matches known company

4. **Components**
   - Update guards to check appropriate company ID
   - No UI changes needed (type still derived from route)

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

### Phase 12: E2E Testing

- Playwright test suite
- User flow coverage (see docs/testing/USER_FLOWS.md)
- CI integration

---

## Infrastructure & Quality

### CI/CD Pipeline

- GitHub Actions workflow: `npm run lint`, `tsc --noEmit`, `npm run build`
- Preview deployments via Vercel
- Concurrency groups to cancel redundant runs

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

---

## Documentation

| Document                                         | Description                |
| ------------------------------------------------ | -------------------------- |
| [PRD.md](./PRD.md)                               | Product requirements       |
| [ARCHITECTURE.md](./ARCHITECTURE.md)             | Codebase architecture      |
| [CONVENTIONS.md](./CONVENTIONS.md)               | Coding standards           |
| [testing/USER_FLOWS.md](./testing/USER_FLOWS.md) | E2E test flows             |
| [ksef/](./ksef/)                                 | KSeF integration reference |
