# Filbert Architecture

This document describes the codebase architecture, data flow patterns, and component organization.

---

## Directory Structure

```
filbert/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, signup, password reset)
│   ├── (protected)/       # Protected routes requiring authentication
│   │   ├── sales/         # Sales invoices list/detail/create
│   │   ├── purchases/     # Purchase invoices list/detail
│   │   ├── settings/      # Company, members, vendors, customers
│   │   └── onboarding/    # First-time setup flow
│   ├── api/               # Route handlers (REST endpoints)
│   └── layout.tsx         # Root layout with i18n + fonts
│
├── components/            # React components
│   ├── layout/           # Shell (sidebar, top-bar, company selector)
│   ├── invoices/         # Invoice components (table, form, filters)
│   ├── customers/        # Customer management
│   ├── vendors/          # Vendor management
│   ├── members/          # Team member management
│   ├── company-settings/ # Company configuration
│   ├── providers/        # Context providers
│   ├── shared/           # Shared utilities
│   └── ui/               # Base UI components (shadcn/ui)
│
├── lib/                   # Core business logic
│   ├── data/             # Server-side data fetching
│   ├── api/              # API utilities (auth middleware, rate limiting)
│   ├── ksef/             # KSeF integration
│   ├── gus/              # GUS API integration
│   ├── supabase/         # Supabase client setup
│   ├── hooks/            # React hooks
│   ├── i18n/             # Internationalization
│   ├── types/            # TypeScript types
│   ├── validations/      # Zod schemas
│   └── utils/            # Utilities
│
├── messages/             # i18n translation files (pl.json, en.json)
├── supabase/             # Supabase migrations
├── docs/                 # Documentation
└── e2e/                  # End-to-end tests (Playwright)
```

---

## Data Flow Patterns

### Server Component → Database → UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Page (Server Component)                                        │
│    └── calls lib/data/*.ts functions                            │
│          └── Supabase query with RLS                            │
│                └── PostgreSQL                                   │
│                      └── Returns typed data                     │
│                            └── Passed as props to Client        │
└─────────────────────────────────────────────────────────────────┘
```

**Example: Invoice List**

```typescript
// app/(protected)/sales/page.tsx (Server Component)
export default async function SalesPage({ searchParams }) {
  const params = await searchParams
  const invoices = await getInvoices(companyId, 'sales', {
    page: params.page,
    search: params.search,
  })
  return <InvoiceTable invoices={invoices} />
}
```

### Mutations via API Routes

```
┌─────────────────────────────────────────────────────────────────┐
│  Client Component                                                │
│    └── fetch('/api/invoices', { method: 'POST', body })         │
│          └── Route Handler (app/api/invoices/route.ts)          │
│                └── Middleware (auth check)                       │
│                      └── Validation (Zod)                        │
│                            └── Supabase insert                   │
│                                  └── Response JSON               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### Layout Structure

```
RootLayout
└── AppShell
    ├── Sidebar
    │   └── Navigation links
    ├── TopBar
    │   ├── CompanySelector
    │   └── LanguageSwitcher
    └── main
        └── Page content
```

### Invoice List Page

```
InvoiceListPage (server)
└── AppShell
    ├── InvoiceFilters (client)
    ├── InvoiceStats
    ├── InvoiceTable (client)
    │   └── InvoiceRow
    │       ├── KsefStatusBadge
    │       └── Actions (view XML, preview)
    └── Pagination (client)
```

### Invoice Detail Page

```
InvoiceDetailPage (server)
└── AppShell
    ├── InvoiceForm / InvoiceFormViewer
    ├── InvoiceItemsTable
    ├── KsefInvoiceView
    └── KsefSendButton
```

---

## State Management

### 1. React Context (Global State)

**CompanyProvider** (`components/providers/company-provider.tsx`)

- Manages current company selection
- Persists to cookie for session continuity
- Triggers `router.refresh()` on change

```typescript
const { currentCompanyId, setCurrentCompanyId, companies } = useCompany()
```

### 2. URL Search Parameters (Filter State)

**useFilterParams** hook stores filters in URL:

- Enables browser back/forward navigation
- Shareable, bookmarkable URLs

```typescript
const { filters, setFilter, resetFilters } = useFilterParams()
// URL: /sales?search=example&dateFrom=2024-01-01
```

### 3. Cookies

| Cookie            | Purpose                     |
| ----------------- | --------------------------- |
| `selectedCompany` | Current company ID          |
| `NEXT_LOCALE`     | Language preference (pl/en) |

### 4. Local React State

For transient UI state (modals, loading, form inputs).

---

## Authentication & Authorization

### Authentication Flow

1. User logs in via Supabase Auth (email/password)
2. Session stored in HTTP-only cookies
3. Server Components check `supabase.auth.getUser()`
4. Protected layout redirects unauthenticated users

### Authorization Middleware

```typescript
// lib/api/middleware.ts
export async function requireAdminAuth(companyId: string) {
  // Returns { user, supabase, companyId } or NextResponse error
}

export async function requireMemberAuth(companyId: string) {
  // Same, but allows member role
}
```

### Role Hierarchy

| Role     | Permissions                                 |
| -------- | ------------------------------------------- |
| `admin`  | Full access, manage members, delete company |
| `member` | Create/edit invoices, view settings         |
| `viewer` | Read-only access                            |

---

## Database Access Pattern

### Data Layer (`lib/data/`)

Each domain has its own file:

- `invoices.ts` - Invoice CRUD with pagination/filtering
- `companies.ts` - Company management, multi-tenancy
- `customers.ts` - Customer operations
- `vendors.ts` - Vendor operations
- `members.ts` - Team member management
- `ksef.ts` - KSeF credentials

**Pattern:**

```typescript
// lib/data/invoices.ts
export async function getInvoices(
  companyId: string,
  type: 'sales' | 'purchase',
  options: InvoiceQueryOptions
): Promise<{ invoices: Invoice[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', type)

  // Apply filters...

  const { data, count, error } = await query
  return { invoices: data ?? [], total: count ?? 0 }
}
```

---

## API Route Pattern

### Standard Structure

```typescript
// app/api/invoices/route.ts
import { requireMemberAuth } from '@/lib/api/middleware'
import { createInvoiceSchema } from '@/lib/validations/invoice'

export async function POST(request: Request) {
  // 1. Auth check
  const auth = await requireMemberAuth(companyId)
  if (auth instanceof NextResponse) return auth

  // 2. Parse & validate
  const body = await request.json()
  const result = createInvoiceSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  // 3. Database operation
  const { data, error } = await auth.supabase.from('invoices').insert(result.data).select().single()

  // 4. Response
  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 })
  }
  return NextResponse.json(data)
}
```

---

## Third-Party Integrations

| Service       | Purpose                 | Key Files                  |
| ------------- | ----------------------- | -------------------------- |
| **Supabase**  | Auth + PostgreSQL       | `lib/supabase/*`           |
| **KSeF**      | Polish e-invoicing      | `lib/ksef/*`               |
| **GUS**       | Polish company registry | `lib/gus/*`                |
| **next-intl** | i18n (PL/EN)            | `lib/i18n/*`, `messages/*` |
| **Radix UI**  | Accessible components   | `components/ui/*`          |
| **Sentry**    | Error tracking          | `sentry.*.config.ts`       |

---

## Key Files Reference

| Task               | Files to Modify                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Add invoice field  | `lib/types/database.ts` → `lib/validations/invoice.ts` → `components/invoices/invoice-form.tsx` → `app/api/invoices/route.ts` |
| Add invoice filter | `lib/data/invoices.ts` → `components/invoices/invoice-filters.tsx` → `lib/hooks/use-filter-params.ts`                         |
| Add settings page  | `app/(protected)/settings/new/page.tsx` → sidebar navigation                                                                  |
| Add translation    | `messages/pl.json` + `messages/en.json`                                                                                       |
| Add API endpoint   | `app/api/new-endpoint/route.ts` with middleware                                                                               |

---

## Important Patterns

### Server vs Client Components

- **Server Components** (default): Data fetching, auth checks, heavy logic
- **Client Components** (`'use client'`): Interactivity, forms, state

### Async in Next.js 16

```typescript
// searchParams and params are Promises
export default async function Page({ searchParams }) {
  const params = await searchParams // Must await
  // ...
}
```

### Type Safety

- Auto-generated Supabase types: `lib/types/database.ts`
- Runtime validation: Zod schemas in `lib/validations/`
- Path alias: `@/*` maps to project root
