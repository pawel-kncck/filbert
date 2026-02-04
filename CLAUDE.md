# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Filbert is a KSeF (Polish e-invoicing system) invoice management application for Polish businesses. It provides a clean interface to view, search, and manage sales and purchase invoices with full KSeF integration.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (Auth + PostgreSQL)

---

## Quick Reference

### Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build (run before committing)
npm run lint         # Run ESLint
npm run i18n:validate  # Validate translation files
```

### Key Directories

| Directory          | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `app/`             | Next.js App Router (pages, layouts, API routes) |
| `components/`      | React components by feature                     |
| `lib/data/`        | Server-side data fetching                       |
| `lib/ksef/`        | KSeF API integration                            |
| `lib/validations/` | Zod schemas                                     |
| `messages/`        | i18n translations (pl.json, en.json)            |
| `docs/`            | Documentation                                   |

### Path Aliases

`@/*` maps to project root. Example: `import { createClient } from '@/lib/supabase/server'`

---

## Development Workflow

**Commit frequently.** After completing each logical unit of work (a feature, bug fix, or significant change), commit and push. Don't wait until the end of a session.

**Before committing:**

1. `npm run build` - Ensure build passes
2. `npm run lint` - Fix linting issues
3. `npm run i18n:validate` - Check translations (if modified)

---

## Architecture Patterns

### Server vs Client Components

```typescript
// Server Component (default) - data fetching
export default async function Page() {
  const data = await getData()  // Direct DB access
  return <ClientComponent data={data} />
}

// Client Component - interactivity
'use client'
export function ClientComponent({ data }) {
  const [state, setState] = useState()
  // ...
}
```

### Data Flow

1. **Server Components** fetch data via `lib/data/*.ts`
2. **API Routes** handle mutations (`app/api/`)
3. **React Context** manages company selection (`CompanyProvider`)
4. **URL params** store filter state

### API Route Pattern

```typescript
// app/api/example/route.ts
import { requireMemberAuth } from '@/lib/api/middleware'

export async function POST(request: Request) {
  const auth = await requireMemberAuth(companyId)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  // Validate with Zod, then database operation
}
```

---

## Domain Glossary

| Term               | Description                                         |
| ------------------ | --------------------------------------------------- |
| **NIP**            | Polish tax ID (10 digits, with checksum validation) |
| **KSeF**           | Krajowy System e-Faktur (National e-Invoice System) |
| **FA(3)**          | Invoice XML schema version used by KSeF             |
| **GUS**            | Polish statistical office (company registry lookup) |
| **PLN**            | Polish Zloty (default currency)                     |
| **Seller/Vendor**  | The company issuing the invoice                     |
| **Buyer/Customer** | The company receiving the invoice                   |

---

## Key Files for Common Tasks

### Adding a New Feature

| Task              | Files to Modify                        |
| ----------------- | -------------------------------------- |
| Add page          | `app/(protected)/feature/page.tsx`     |
| Add API endpoint  | `app/api/feature/route.ts`             |
| Add data function | `lib/data/feature.ts`                  |
| Add component     | `components/feature/component.tsx`     |
| Add translations  | `messages/pl.json`, `messages/en.json` |

### Modifying Invoices

| Task             | Files                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Add field        | `lib/types/database.ts` → migration → `lib/validations/invoice.ts` → components |
| Add filter       | `lib/data/invoices.ts` → `components/invoices/invoice-filters.tsx`              |
| Modify KSeF send | `lib/ksef/fa3-xml-builder.ts` → `app/api/invoices/[id]/ksef/send/route.ts`      |

### Working with KSeF

| Task           | Files                                                   |
| -------------- | ------------------------------------------------------- |
| Auth flow      | `lib/ksef/auth.ts`, `lib/ksef/crypto.ts`                |
| Send invoice   | `lib/ksef/api-client.ts`, `lib/ksef/fa3-xml-builder.ts` |
| Parse invoice  | `lib/ksef/fa3-xml-parser.ts`                            |
| XML validation | `lib/validations/ksef-fa3.ts`                           |

---

## Debugging Tips

### KSeF Issues

1. Check credentials in `/settings/company` (admin only)
2. Verify environment (test/demo/prod) matches credentials
3. Look for `[KSeF]` or `[FA3 Parser]` console logs
4. Check `ksef_error` column in database for failed invoices
5. Use XML viewer (`/api/invoices/[id]/xml`) for raw XML

### Auth Issues

1. Check Supabase session: `supabase.auth.getUser()`
2. Verify RLS policies in Supabase dashboard
3. Check `user_companies` table for role assignment

### Build Errors

1. Run `npm run build` locally to see full errors
2. Check `lib/types/database.ts` matches migrations
3. Verify all imports use `@/` path alias

---

## Database

### Main Tables

| Table                      | Purpose                            |
| -------------------------- | ---------------------------------- |
| `companies`                | Company info with NIP              |
| `user_companies`           | User-company relationships + roles |
| `invoices`                 | Invoice records                    |
| `invoice_items`            | Invoice line items                 |
| `vendors`                  | Vendor contacts                    |
| `customers`                | Customer contacts                  |
| `company_ksef_credentials` | KSeF auth credentials              |

### Roles

| Role     | Permissions                                 |
| -------- | ------------------------------------------- |
| `admin`  | Full access, manage members, delete company |
| `member` | Create/edit invoices, view settings         |
| `viewer` | Read-only access                            |

### Row Level Security

All tables have RLS policies. Users only see data for companies they belong to.

---

## Supabase Configuration

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...  # Client-side
SUPABASE_SECRET_KEY=sb_secret_...                         # Server-side only
```

### Client Setup

```typescript
// Server-side (lib/supabase/server.ts)
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(url, key, { cookies: { ... } })
}

// Client-side (lib/supabase/client.ts)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(url, key)
}
```

---

## Internationalization

### Adding Translations

1. Add key to `messages/pl.json`:

   ```json
   { "namespace": { "key": "Polski tekst" } }
   ```

2. Add same key to `messages/en.json`:

   ```json
   { "namespace": { "key": "English text" } }
   ```

3. Run `npm run i18n:validate` to verify

### Using Translations

```typescript
// Server Component
import { getTranslations } from 'next-intl/server'
const t = await getTranslations('namespace')
return <h1>{t('key')}</h1>

// Client Component
import { useTranslations } from 'next-intl'
const t = useTranslations('namespace')
return <span>{t('key')}</span>
```

---

## Documentation

For detailed documentation, see `docs/`:

| Document                                            | Description                |
| --------------------------------------------------- | -------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)             | Codebase architecture      |
| [CONVENTIONS.md](docs/CONVENTIONS.md)               | Coding standards           |
| [PRD.md](docs/PRD.md)                               | Product requirements       |
| [ROADMAP.md](docs/ROADMAP.md)                       | Implementation roadmap     |
| [testing/USER_FLOWS.md](docs/testing/USER_FLOWS.md) | E2E test flows             |
| [ksef/](docs/ksef/)                                 | KSeF integration reference |
