# Filbert

A KSeF (Polish e-invoicing system) invoice management application for Polish businesses. Provides a clean interface to view, search, and manage sales and purchase invoices.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend:** Supabase (Auth + PostgreSQL)
- **Fonts:** Geist (via `next/font`)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Environment Setup

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

> **Note:** Supabase has deprecated the legacy `anon` and `service_role` keys. Use the new `sb_publishable_...` and `sb_secret_...` key formats. See [Supabase API Keys documentation](https://supabase.com/docs/guides/api/api-keys) for details.

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

## Database Setup

Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nip VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_companies (
  user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  type TEXT CHECK (type IN ('sales', 'purchase')) NOT NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_nip VARCHAR(10),
  customer_name TEXT NOT NULL,
  customer_nip VARCHAR(10),
  net_amount DECIMAL(12,2) NOT NULL,
  vat_amount DECIMAL(12,2) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PLN',
  ksef_reference TEXT,
  source TEXT CHECK (source IN ('manual', 'demo', 'ksef')) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for search performance
CREATE INDEX idx_invoices_company_type ON invoices(company_id, type);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX idx_invoices_customer_name ON invoices(customer_name);
```

### Row Level Security

Enable RLS and add policies to ensure users only access their company data:

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company invoices" ON invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  );
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase API Keys Migration](https://github.com/orgs/supabase/discussions/29260)

## Deploy

Deploy on [Vercel](https://vercel.com/new) - the easiest way to deploy Next.js apps.
