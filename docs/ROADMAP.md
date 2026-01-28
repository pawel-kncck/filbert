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
- Translation files: messages/pl.json, messages/en.json (170+ keys)
- Validation script: `npm run i18n:validate`

### Phase 5: Contacts & Invoice Management

- **5a: Vendors List** — CRUD vendor contacts with sync from purchase invoices, search/pagination, missing vendors alert
- **5b: Customers List** — CRUD customer contacts with sync from sales invoices, "Create invoice" action linking to `/sales/new?customer=`
- **5c: Invoice Items** — `invoice_items` table with RLS, display on invoice detail pages, currency-formatted totals
- **5d: Create Sales Invoice** — `/sales/new` form with dynamic line items, copy invoice flow, customer prefill, auto-calculated amounts
- **5e: FA(3) Schema Validation** — KSeF FA(3) Zod schema with field-level inline errors, server-side validation (HTTP 422), translation message keys
- **5f: KSeF Invoice Preview** — Styled A4-like preview modal with QR code (KOD I), `ksef_hash` column, preview button on table and detail page
- **5g: Sidebar & Translation Updates** — Navigation entries for all Phase 5 features, 350 translation keys (PL + EN)

---

## Phase 5: Contacts & Invoice Management (Detailed Specs)

### 5a: Vendors List

**Goal:** Manage vendor contacts, populated from purchase invoices.

#### Database Schema

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  nip VARCHAR(10),
  address TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, nip)
);

CREATE INDEX idx_vendors_company ON vendors(company_id);
CREATE INDEX idx_vendors_nip ON vendors(nip);
CREATE INDEX idx_vendors_name ON vendors(name);
```

#### RLS Policies

```sql
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendors" ON vendors
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create vendors" ON vendors
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'member')
        AND status = 'active'
    )
  );

CREATE POLICY "Users can update vendors" ON vendors
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'member')
        AND status = 'active'
    )
  );

CREATE POLICY "Admins can delete vendors" ON vendors
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );
```

#### Files to Create

| File                                                      | Description                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `supabase/migrations/003_add_vendors_customers_items.sql` | Database migration                                                       |
| `lib/data/vendors.ts`                                     | Data layer: getVendors, getMissingVendors, syncVendorsFromInvoices, CRUD |
| `app/(protected)/settings/vendors/page.tsx`               | Vendors list page                                                        |
| `components/vendors/vendors-table.tsx`                    | Table with vendor rows                                                   |
| `components/vendors/vendor-actions.tsx`                   | Edit, Show invoices, Delete buttons                                      |
| `components/vendors/vendor-form-dialog.tsx`               | Add/Edit modal form                                                      |
| `components/vendors/vendor-filters.tsx`                   | Search filter                                                            |
| `components/vendors/add-vendor-button.tsx`                | Add vendor button                                                        |
| `components/vendors/missing-vendors-alert.tsx`            | Alert for unsynced vendors                                               |
| `app/api/vendors/route.ts`                                | POST: create vendor                                                      |
| `app/api/vendors/[vendorId]/route.ts`                     | PATCH: update, DELETE: remove                                            |
| `app/api/vendors/sync/route.ts`                           | POST: sync from invoices                                                 |

#### Features

1. **List View:** Paginated table with search (name/NIP)
2. **Add Vendor:** Modal form with fields: name, NIP, address, email, phone, notes
3. **Edit Vendor:** Same modal, pre-filled with existing data
4. **Delete Vendor:** Admin only, with confirmation
5. **Show Invoices:** Navigate to `/purchases?search={vendor.name}`
6. **Sync from Invoices:** Import missing vendors from purchase invoices
7. **Missing Alert:** Banner showing count of unsynced vendors

#### Data Layer Functions

```typescript
// lib/data/vendors.ts
export async function getVendors(
  companyId: string,
  options: { page?: number; filters?: { search?: string } }
)
export async function getVendorById(vendorId: string, companyId: string)
export async function getMissingVendors(companyId: string) // Vendors from invoices not in table
export async function syncVendorsFromInvoices(companyId: string) // Create vendor records
export async function createVendor(vendor: VendorInsert)
export async function updateVendor(vendorId: string, companyId: string, updates: VendorUpdate)
export async function deleteVendor(vendorId: string, companyId: string)
```

---

### 5b: Customers List

**Goal:** Manage customer contacts, populated from sales invoices.

#### Database Schema

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  nip VARCHAR(10),
  address TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, nip)
);

CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_nip ON customers(nip);
CREATE INDEX idx_customers_name ON customers(name);
```

#### RLS Policies

Same pattern as vendors table.

#### Files to Create

| File                                               | Description                                     |
| -------------------------------------------------- | ----------------------------------------------- |
| `lib/data/customers.ts`                            | Data layer (same functions as vendors)          |
| `app/(protected)/settings/customers/page.tsx`      | Customers list page                             |
| `components/customers/customers-table.tsx`         | Table with customer rows                        |
| `components/customers/customer-actions.tsx`        | Edit, Show invoices, **Create invoice**, Delete |
| `components/customers/customer-form-dialog.tsx`    | Add/Edit modal form                             |
| `components/customers/customer-filters.tsx`        | Search filter                                   |
| `components/customers/add-customer-button.tsx`     | Add customer button                             |
| `components/customers/missing-customers-alert.tsx` | Alert for unsynced customers                    |
| `app/api/customers/route.ts`                       | POST: create customer                           |
| `app/api/customers/[customerId]/route.ts`          | PATCH: update, DELETE: remove                   |
| `app/api/customers/sync/route.ts`                  | POST: sync from invoices                        |

#### Additional Feature: Create Invoice

The "Create invoice" action on customer row navigates to `/sales/new?customer={customerId}` with customer data pre-filled.

---

### 5c: Invoice Items

**Goal:** Support line items on invoices. Invoice totals = SUM of all items.

#### Database Schema

```sql
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  position INT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'szt.',
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 23,
  net_amount DECIMAL(12,2) NOT NULL,
  vat_amount DECIMAL(12,2) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
```

#### RLS Policies

```sql
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice items" ON invoice_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM user_companies
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can create invoice items" ON invoice_items
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM user_companies
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'member')
          AND status = 'active'
      )
    )
  );
```

#### Item Calculations

```typescript
// Per item:
net_amount = quantity * unit_price
vat_amount = net_amount * (vat_rate / 100)
gross_amount = net_amount + vat_amount

// Invoice totals:
invoice.net_amount = SUM(items.net_amount)
invoice.vat_amount = SUM(items.vat_amount)
invoice.gross_amount = SUM(items.gross_amount)
```

#### Unit Types

| Code  | Polish          | English      |
| ----- | --------------- | ------------ |
| szt.  | sztuka          | piece        |
| godz. | godzina         | hour         |
| kg    | kilogram        | kilogram     |
| m     | metr            | meter        |
| m²    | metr kwadratowy | square meter |
| usł.  | usługa          | service      |

#### Files to Create

| File                                          | Description              |
| --------------------------------------------- | ------------------------ |
| `lib/data/invoice-items.ts`                   | Data layer for items     |
| `lib/types/database.ts`                       | Add InvoiceItem type     |
| `components/invoices/invoice-items-table.tsx` | Items table (display)    |
| `components/invoices/invoice-item-row.tsx`    | Single editable item row |

#### Files to Modify

| File                                      | Change                          |
| ----------------------------------------- | ------------------------------- |
| `lib/data/invoices.ts`                    | Include items in getInvoiceById |
| `app/(protected)/sales/[id]/page.tsx`     | Display items table             |
| `app/(protected)/purchases/[id]/page.tsx` | Display items table             |

---

### 5d: Create Sales Invoice

**Goal:** Allow users to create new sales invoices with line items.

#### Entry Points

1. **Sidebar "Nowa faktura" button** → `/sales/new`
2. **Customer list "Create invoice"** → `/sales/new?customer={customerId}`
3. **Sales list "Copy" button** → `/sales/new?copy={invoiceId}`

#### Page Structure

```
/sales/new
├── Invoice Header
│   ├── Invoice Number (text, required)
│   ├── Issue Date (date, required, default: today)
│   ├── Customer Name (text, required, auto-filled if customer param)
│   ├── Customer NIP (text, optional, 10 digits)
│   └── Currency (select: PLN, EUR, USD)
├── Items Table
│   ├── Item Row 1 (description, qty, unit, price, VAT, amounts)
│   ├── Item Row 2 ...
│   ├── [+ Add Item] button
│   └── Totals Row (sum of all items)
├── Notes (textarea, optional)
└── Actions
    ├── [Cancel] → /sales
    └── [Save] → Create invoice + items → /sales/{id}
```

#### Form Behavior

- Start with 1 empty item row
- "Add item" button adds new row
- "Remove" button (trash icon) on each row, minimum 1 item required
- Item amounts auto-calculate on quantity/price/VAT rate change
- Invoice totals auto-sum from all items
- Vendor fields auto-filled from current company data
- On save: create invoice + all items in database transaction
- Validation runs before save (see 5e)

#### Copy Invoice Flow

1. User clicks "Copy" on existing invoice in sales list
2. Navigates to `/sales/new?copy={invoiceId}`
3. Form loads with all data + items copied EXCEPT:
   - Invoice number (empty, user must enter new one)
   - Issue date (set to today)
   - KSeF reference (cleared)
   - source set to 'manual'
4. User modifies as needed and saves as new invoice

#### Files to Create

| File                                   | Description                        |
| -------------------------------------- | ---------------------------------- |
| `app/(protected)/sales/new/page.tsx`   | New invoice page                   |
| `components/invoices/invoice-form.tsx` | Invoice form with items management |
| `components/invoices/nip-input.tsx`    | NIP input with validation          |
| `lib/validations/invoice.ts`           | Zod schema for form validation     |
| `app/api/invoices/route.ts`            | POST: create invoice with items    |

#### Files to Modify

| File                                    | Change                    |
| --------------------------------------- | ------------------------- |
| `components/layout/sidebar.tsx`         | Add "Nowa faktura" button |
| `components/invoices/invoice-table.tsx` | Add "Copy" action button  |

---

### 5e: FA(3) Schema Validation

**Goal:** Validate invoices against KSeF FA(3) schema before saving.

#### Required Fields (Invoice Header)

| Field          | FA(3) Element                       | Validation                              |
| -------------- | ----------------------------------- | --------------------------------------- |
| invoice_number | P_2                                 | Required, max 256 chars                 |
| issue_date     | P_1                                 | Required, format YYYY-MM-DD, not future |
| vendor_name    | DaneIdentyfikacyjneSprzedawcy/Nazwa | Required, max 256 chars                 |
| vendor_nip     | NrEwidencyjnyPodatnika              | Required for Polish vendors, 10 digits  |
| customer_name  | DaneIdentyfikacyjneNabywcy/Nazwa    | Required, max 256 chars                 |
| customer_nip   | NrNIP                               | Required for Polish B2B, 10 digits      |
| currency       | KodWaluty                           | Required, ISO 4217 (PLN, EUR, USD)      |
| net_amount     | P_13_1                              | Must match sum of items                 |
| vat_amount     | P_14_1                              | Must match sum of items                 |
| gross_amount   | P_15                                | Must equal net + vat                    |

#### Required Fields (Invoice Items)

| Field       | FA(3) Element | Validation                                 |
| ----------- | ------------- | ------------------------------------------ |
| description | P_7           | Required, max 256 chars                    |
| quantity    | P_8A          | Required, > 0                              |
| unit        | P_8B          | Required                                   |
| unit_price  | P_9A          | Required, >= 0                             |
| vat_rate    | P_12          | Required (23, 8, 5, 0, or "zw" for exempt) |
| net_amount  | P_11          | Must equal qty × unit_price                |
| vat_amount  | P_11A         | Must equal net × vat_rate%                 |

#### Validation Behavior

- Run validation on form submit before API call
- Show field-level errors for invalid fields
- Show summary error banner if validation fails
- Prevent save until all errors are fixed

#### Files to Create

| File                          | Description                            |
| ----------------------------- | -------------------------------------- |
| `lib/validations/ksef-fa3.ts` | FA(3) schema validation rules          |
| `lib/ksef/fa3-validator.ts`   | Validator function with error messages |

---

### 5f: KSeF Invoice Preview

**Goal:** Styled visualization of KSeF invoices with QR code.

#### Database Update

```sql
ALTER TABLE invoices ADD COLUMN ksef_hash TEXT;
```

The `ksef_hash` stores the SHA-256 Base64URL hash from KSeF, required for QR code generation.

#### KSeF QR Code Specification (KOD I)

Per official KSeF documentation ([CIRFMF/ksef-docs](https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md)):

**URL Structure:**

```
https://qr.ksef.mf.gov.pl/invoice/{NIP}/{DATE}/{HASH}
```

| Parameter | Format                                    | Example           |
| --------- | ----------------------------------------- | ----------------- |
| NIP       | Seller's 10-digit tax ID                  | `1111111111`      |
| DATE      | Issue date as `DD-MM-RRRR`                | `01-02-2026`      |
| HASH      | SHA-256 of invoice XML, Base64URL encoded | `UtQp9Gpc51y-...` |

**Environment URLs:**

| Environment | URL                              |
| ----------- | -------------------------------- |
| Test        | `https://qr-test.ksef.mf.gov.pl` |
| Demo        | `https://qr-demo.ksef.mf.gov.pl` |
| Production  | `https://qr.ksef.mf.gov.pl`      |

**QR Code Generation:**

```typescript
// lib/ksef/generate-qr-data.ts
function generateKsefQrUrl(
  invoice: Invoice,
  environment: 'test' | 'demo' | 'prod' = 'prod'
): string {
  const baseUrls = {
    test: 'https://qr-test.ksef.mf.gov.pl',
    demo: 'https://qr-demo.ksef.mf.gov.pl',
    prod: 'https://qr.ksef.mf.gov.pl',
  }

  const nip = invoice.vendor_nip
  const date = formatDate(invoice.issue_date, 'DD-MM-YYYY')
  const hash = invoice.ksef_hash

  return `${baseUrls[environment]}/invoice/${nip}/${date}/${hash}`
}
```

**Display Requirements:**

- QR code must comply with ISO/IEC 18004:2024
- Use 5-pixel-per-module scaling for print readability
- Display KSeF reference number below QR code

#### Preview Modal Features

1. **Document Header:** "FAKTURA VAT" title
2. **Invoice Number & Dates:** Invoice number, issue date, sale date
3. **Seller Section:** Name, NIP, address
4. **Buyer Section:** Name, NIP, address
5. **Items Table:** Position, Description, Qty, Unit, Unit Price, VAT Rate, Net, VAT, Gross
6. **Totals Section:** Sum by VAT rate, total net/vat/gross
7. **QR Code:** KOD I verification link
8. **KSeF Reference:** Display reference number below QR

#### Invoice Table Updates

Add "Preview" button for KSeF invoices:

```typescript
{invoice.source === 'ksef' && invoice.ksef_reference && (
  <button onClick={() => openPreview(invoice)}>
    {t('invoices.actions.preview')}
  </button>
)}
```

#### Files to Create

| File                                         | Description                 |
| -------------------------------------------- | --------------------------- |
| `components/invoices/ksef-preview-modal.tsx` | Modal wrapper               |
| `components/invoices/ksef-invoice-view.tsx`  | Styled A4-like invoice view |
| `components/invoices/ksef-qr-code.tsx`       | QR code component           |
| `lib/ksef/generate-qr-data.ts`               | QR URL generation           |

#### Dependencies

```bash
npm install qrcode.react
```

---

### 5g: Sidebar & Translation Updates

#### Sidebar Structure

```
[Sales icon] Sprzedaż
[Purchases icon] Zakupy
[+ icon] Nowa faktura  ← NEW

Ustawienia
├── [Users icon] Członkowie
├── [Building icon] Dostawcy  ← NEW
└── [People icon] Klienci    ← NEW
```

#### Translations to Add

**Polish (messages/pl.json):**

```json
{
  "vendors": {
    "title": "Dostawcy",
    "noVendors": "Brak dostawców",
    "addVendor": "Dodaj dostawcę",
    "synced": "Zsynchronizowany",
    "syncAll": "Synchronizuj wszystko",
    "missingVendorsAlert": "{count} dostawców z faktur nie jest na liście",
    "table": { "name": "Nazwa", "email": "Email", "phone": "Telefon", "added": "Dodano", "actions": "Akcje" },
    "form": { "addTitle": "Dodaj dostawcę", "editTitle": "Edytuj dostawcę", "name": "Nazwa firmy", ... },
    "actions": { "showInvoices": "Pokaż faktury", "edit": "Edytuj", "delete": "Usuń" }
  },
  "customers": {
    "title": "Klienci",
    "noCustomers": "Brak klientów",
    "addCustomer": "Dodaj klienta",
    "actions": { "createInvoice": "Wystaw fakturę", ... }
  },
  "invoiceForm": {
    "title": "Nowa faktura",
    "editTitle": "Edytuj fakturę",
    "invoiceNumber": "Numer faktury",
    "issueDate": "Data wystawienia",
    "customer": "Nabywca",
    "items": "Pozycje",
    "addItem": "Dodaj pozycję",
    "totals": "Podsumowanie",
    ...
  },
  "navigation": {
    "newInvoice": "Nowa faktura",
    "vendors": "Dostawcy",
    "customers": "Klienci"
  }
}
```

**English (messages/en.json):** Mirror structure with English translations.

---

## Future Phases

### Phase 6: Dashboard & Analytics

- Summary cards (total invoices, revenue, expenses, balance)
- Monthly trends chart (line/bar)
- Top 5 vendors by purchase amount
- Top 5 customers by sales amount
- Period selector (this month, last 3 months, this year, custom)

### Phase 7: Company Settings

- Edit company name
- View NIP (read-only)
- KSeF credentials management
- Delete company (with confirmation)

### Phase 8: KSeF Integration

- Store KSeF API credentials (encrypted)
- Fetch invoices from KSeF
- Send invoices to KSeF
- Sync status indicator
- Error handling for API failures

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
