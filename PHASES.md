# Filbert Implementation Phases

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

---

## Upcoming Phases

### Phase 5: Manual Invoice Entry

**Goal:** Allow users to create and edit invoices manually.

#### Features
- Create new sales invoice form
- Create new purchase invoice form
- Edit existing invoices
- Form validation (required fields, NIP format, amounts)
- Draft saving (optional)
- Delete invoice with confirmation

#### Files to Create
```
app/(protected)/sales/new/page.tsx        # New sales invoice form
app/(protected)/purchases/new/page.tsx    # New purchase invoice form
app/(protected)/sales/[id]/edit/page.tsx  # Edit sales invoice
app/(protected)/purchases/[id]/edit/page.tsx  # Edit purchase invoice

components/invoices/invoice-form.tsx      # Shared invoice form component
components/invoices/nip-input.tsx         # NIP input with validation
components/invoices/amount-inputs.tsx     # Net/VAT/Gross with auto-calculation

lib/validations/invoice.ts                # Zod schema for invoice validation
lib/actions/invoices.ts                   # Server actions for CRUD

app/api/invoices/route.ts                 # POST: create invoice
app/api/invoices/[id]/route.ts            # PUT: update, DELETE: remove
```

#### Invoice Form Fields
| Field | Type | Validation |
|-------|------|------------|
| invoice_number | text | Required |
| issue_date | date | Required, not future |
| vendor_name | text | Required |
| vendor_nip | text | Optional, 10 digits |
| customer_name | text | Required |
| customer_nip | text | Optional, 10 digits |
| net_amount | decimal | Required, > 0 |
| vat_amount | decimal | Required, >= 0 |
| gross_amount | decimal | Auto-calculated |
| currency | select | PLN, EUR, USD |

#### UI Components
- "Nowa faktura" button on sales/purchases pages
- Form with sections: Basic Info, Seller, Buyer, Amounts
- Cancel/Save buttons
- Success toast after save
- Redirect to invoice detail page

---

### Phase 6: Dashboard & Analytics

**Goal:** Provide visual insights into invoice data.

#### Features
- Summary cards (total invoices, revenue, expenses, balance)
- Monthly trends chart (line/bar)
- Top 5 vendors by purchase amount
- Top 5 customers by sales amount
- Recent activity feed
- Period selector (this month, last 3 months, this year, custom)

#### Files to Create
```
app/(protected)/dashboard/page.tsx        # Replace redirect with actual dashboard

components/dashboard/summary-cards.tsx    # KPI cards
components/dashboard/monthly-chart.tsx    # Recharts line/bar chart
components/dashboard/top-vendors.tsx      # Top vendors list
components/dashboard/top-customers.tsx    # Top customers list
components/dashboard/recent-activity.tsx  # Recent invoices feed
components/dashboard/period-selector.tsx  # Date range selector

lib/data/analytics.ts                     # Aggregation queries
```

#### Dependencies
```bash
npm install recharts
```

#### Summary Cards
| Card | Value | Comparison |
|------|-------|------------|
| Faktury sprzedaży | Count | vs previous period |
| Przychody | Sum gross (sales) | vs previous period |
| Faktury zakupu | Count | vs previous period |
| Wydatki | Sum gross (purchases) | vs previous period |

---

### Phase 7: Company Settings

**Goal:** Allow admins to manage company details and preferences.

#### Features
- Edit company name
- View NIP (read-only after creation)
- KSeF credentials management (placeholder for Phase 8)
- Company logo upload (optional)
- Delete company (with confirmation, transfer ownership)

#### Files to Create
```
app/(protected)/settings/company/page.tsx  # Company settings page

components/settings/company-form.tsx       # Edit company details
components/settings/ksef-credentials.tsx   # KSeF API key management
components/settings/danger-zone.tsx        # Delete company section

lib/actions/companies.ts                   # Server actions for company updates

app/api/companies/[id]/route.ts            # PUT: update company
```

#### Update Sidebar
Add link to /settings/company under "Ustawienia" section.

---

### Phase 8: KSeF Integration

**Goal:** Connect to Polish National e-Invoice System.

#### Features
- Store KSeF API credentials (encrypted)
- Fetch invoices from KSeF
- Sync status indicator
- Send invoices to KSeF
- KSeF reference number display
- Error handling for API failures

#### Files to Create
```
lib/ksef/client.ts                        # KSeF API client
lib/ksef/types.ts                         # KSeF data types
lib/ksef/mappers.ts                       # Map KSeF format to our schema

app/api/ksef/sync/route.ts                # POST: trigger sync
app/api/ksef/send/[invoiceId]/route.ts    # POST: send invoice to KSeF

components/ksef/sync-button.tsx           # Manual sync trigger
components/ksef/sync-status.tsx           # Last sync time, status
components/ksef/ksef-badge.tsx            # Show KSeF reference on invoice
```

#### Environment Variables
```
KSEF_API_URL=https://ksef.mf.gov.pl/api
KSEF_ENVIRONMENT=test|prod
```

#### Database Changes
```sql
ALTER TABLE companies ADD COLUMN ksef_token_encrypted TEXT;
ALTER TABLE companies ADD COLUMN ksef_last_sync TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN ksef_status TEXT CHECK (ksef_status IN ('pending', 'sent', 'accepted', 'rejected'));
```

---

### Phase 9: Notifications & Audit

**Goal:** Keep users informed and track changes.

#### Features
- Email notifications for:
  - New pending member request (to admins)
  - Membership approved/rejected (to user)
  - KSeF sync completed (optional)
- In-app notification bell
- Audit log for:
  - Invoice created/updated/deleted
  - Member added/removed/role changed
  - Company settings changed

#### Files to Create
```
lib/notifications/email.ts                # Email sending (Resend/SendGrid)
lib/notifications/templates/              # Email templates

components/layout/notification-bell.tsx   # Bell icon with badge

app/(protected)/settings/audit/page.tsx   # Audit log viewer
lib/data/audit.ts                         # Audit log queries

app/api/notifications/route.ts            # GET: fetch notifications
```

#### Database Changes
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Notes

### General Guidelines
- Run `npm run build` and `npm run lint` before committing
- Commit frequently with descriptive messages
- All UI text in Polish
- Use existing component patterns (zinc colors, dark mode support)
- Follow existing data layer patterns in `lib/data/`

### Tech Stack Reference
- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Auth + PostgreSQL)
- @supabase/ssr for SSR support

### Path Aliases
- `@/*` maps to project root
- Example: `import { createClient } from '@/lib/supabase/server'`
