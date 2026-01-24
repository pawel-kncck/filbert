# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Filbert is a KSeF (Polish e-invoicing system) invoice management application for Polish businesses. It provides a clean interface to view, search, and manage sales and purchase invoices.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (Auth + PostgreSQL)

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Next.js App Router Structure

- `app/` - App Router pages and layouts
  - `layout.tsx` - Root layout with Geist font configuration
  - `page.tsx` - Home page
  - `globals.css` - Global styles with Tailwind

### Path Aliases

`@/*` maps to the project root (configured in tsconfig.json)

### Planned Architecture (from PRD)

The application will include:
- **Authentication:** Supabase Auth with email/password
- **Multi-tenancy:** Users can belong to multiple companies with roles (`admin` | `member`)
- **Invoice Views:** Separate routes for `/sales` and `/purchases` invoices
- **Layout:** Fixed left sidebar (~240px), main content area with top bar for company selector

## Supabase Backend

### API Keys (IMPORTANT - New Key Format)

Supabase has deprecated the legacy `anon` and `service_role` JWT-based keys. Use the new key format:

| Legacy (Deprecated) | New Format | Use Case |
|---------------------|------------|----------|
| `anon` | `sb_publishable_...` | Client-side (browser, mobile) |
| `service_role` | `sb_secret_...` | Server-side only |

**Key rules:**
- **Publishable keys** (`sb_publishable_...`): Safe for client-side code, protected by Row Level Security
- **Secret keys** (`sb_secret_...`): Server-side only, bypasses RLS, never expose in browser
- New keys cannot be used in `Authorization: Bearer` header (use `apikey` header instead)
- Secret keys return HTTP 401 if used in browsers

**Timeline:**
- Nov 2025: New projects no longer have `anon`/`service_role` keys
- Late 2026: Legacy keys deleted entirely

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...  # Client-side
SUPABASE_SECRET_KEY=sb_secret_...                         # Server-side only
```

### Database Schema

Three main tables:
- `companies` - Company info with NIP (Polish tax ID)
- `user_companies` - Many-to-many user-company relationship with roles
- `invoices` - Invoice records with type (`sales` | `purchase`), source (`manual` | `demo` | `ksef`)

### Row Level Security (RLS)

RLS is mandatory for all tables. Users only see data for companies they belong to. Example policy:

```sql
CREATE POLICY "Users can view own company invoices" ON invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  );
```

### Supabase Client Setup

```typescript
// lib/supabase/client.ts - Browser client
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

// lib/supabase/server.ts - Server client (Server Components, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cookiesToSet) => { /* ... */ } } }
  )
}
```

## Domain Context

- **NIP** - Polish tax identification number (10 digits)
- **KSeF** - Krajowy System e-Faktur (Polish National e-Invoice System)
- Invoice amounts use PLN (Polish Zloty) as default currency
- Invoice fields: net_amount, vat_amount, gross_amount
