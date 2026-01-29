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
