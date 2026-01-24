# Filbert - Product Requirements Document

## Overview

**Product Name:** Filbert  
**Version:** 1.0 (MVP)  
**Target Market:** Polish businesses needing to view and manage KSeF invoices  
**Tech Stack:** Next.js, Supabase (Auth + Database), TypeScript

---

## Problem Statement

Polish companies need a simple, clean interface to view and search their invoices from KSeF. Existing solutions are often overcomplicated or lack intuitive search and filtering capabilities. Filbert provides a focused, easy-to-use invoice viewing experience.

---

## User Personas

**Primary User:** Small business owner or accountant in Poland who needs to quickly find and review invoices.

**Key Needs:**

- Fast access to sales and purchase invoices
- Powerful search and filtering
- Clean, distraction-free interface

---

## Core Features

### 1. Authentication & User Management

| Feature            | Description                                    |
| ------------------ | ---------------------------------------------- |
| Sign Up            | Email/password registration via Supabase Auth  |
| Sign In            | Email/password login                           |
| Password Reset     | Standard email-based recovery flow             |
| Session Management | Persistent sessions with secure token handling |

### 2. Company Management

**On Registration Flow:**

- User creates account
- User either:
  - **Creates new company** (becomes admin) — enters company name and NIP (Polish tax ID)
  - **Joins existing company** via invitation code/link (becomes member)

**Company Data Model:**

- Company ID
- Company Name
- NIP (tax identification number)
- Created At
- Owner/Admin User ID

**User-Company Relationship:**

- Many-to-many (user can belong to multiple companies)
- Role per company: `admin` | `member`
- User selects active company context after login

### 3. Invoice Management

#### 3.1 Invoice Data Model

```
Invoice {
  id: UUID
  company_id: UUID
  type: 'sales' | 'purchase'
  invoice_number: string
  issue_date: date
  vendor_name: string
  vendor_nip: string
  customer_name: string
  customer_nip: string
  net_amount: decimal
  vat_amount: decimal
  gross_amount: decimal
  currency: string (default: PLN)
  ksef_reference: string (nullable)
  created_at: timestamp
  source: 'manual' | 'demo' | 'ksef'
}
```

#### 3.2 Invoice Sources (MVP)

| Source         | Description                             |
| -------------- | --------------------------------------- |
| Manual Entry   | User creates invoice via form           |
| Demo Generator | System generates random sample invoices |
| KSeF Import    | _Future: API integration with KSeF_     |

### 4. Dashboard & Navigation

**Layout:**

- Left sidebar (fixed, ~240px width)
- Main content area (white background)
- Top bar with company selector and user menu

**Navigation Items:**
| Menu Item | Route | Description |
|-----------|-------|-------------|
| Sales | `/sales` | Sales invoices dashboard |
| Purchases | `/purchases` | Purchase invoices dashboard |

### 5. Invoice List View (Sales & Purchases)

**Display Columns:**

- Invoice Number
- Date
- Vendor/Customer Name (depending on view)
- NIP
- Net Amount
- VAT
- Gross Amount
- Source indicator

**Search & Filter Panel:**

| Filter          | Type                    | Description                                      |
| --------------- | ----------------------- | ------------------------------------------------ |
| Text Search     | Input                   | Searches vendor/customer name and invoice number |
| Vendor/Customer | Dropdown/Autocomplete   | Filter by specific counterparty                  |
| Date Range      | Date picker (from-to)   | Filter by issue date                             |
| Amount Range    | Number inputs (min-max) | Filter by gross amount                           |

**Sorting:**

- Default: Issue date (newest first)
- Clickable column headers for sorting

**Pagination:**

- 25 items per page
- Page navigation at bottom

### 6. Demo Invoice Generator

**Purpose:** Allow users to populate their account with sample data for testing/demo purposes.

**Functionality:**

- Button in dashboard: "Generate Demo Invoices"
- Generates 20-50 random invoices
- Randomizes: dates (last 12 months), amounts (100-50,000 PLN), vendor/customer names from Polish company name pool
- Marks invoices with `source: 'demo'`
- Can be cleared via "Remove Demo Data" action

---

## UI/UX Specifications

### Color Palette

| Element        | Color                  |
| -------------- | ---------------------- |
| Background     | `#FFFFFF` (white)      |
| Sidebar        | `#F8F9FA` (light gray) |
| Primary Action | `#2563EB` (blue)       |
| Text Primary   | `#111827` (near black) |
| Text Secondary | `#6B7280` (gray)       |
| Border         | `#E5E7EB` (light gray) |

### Layout Wireframe

```
┌──────────────────────────────────────────────────────┐
│  Logo          Company ▼        User Menu           │
├─────────┬────────────────────────────────────────────┤
│         │                                            │
│  Sales  │   [Search...]  [Filters ▼]  [+ Invoice]   │
│         │                                            │
│ Purchase│   ┌─────────────────────────────────────┐  │
│         │   │ Invoice List Table                  │  │
│         │   │                                     │  │
│         │   │                                     │  │
│         │   │                                     │  │
│         │   └─────────────────────────────────────┘  │
│         │                                            │
│         │   [◀ 1 2 3 ... 10 ▶]                      │
└─────────┴────────────────────────────────────────────┘
```

---

## Technical Architecture

### Database Schema (Supabase/PostgreSQL)

```sql
-- Users handled by Supabase Auth

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

### Row Level Security (RLS)

```sql
-- Users can only see invoices for companies they belong to
CREATE POLICY "Users can view own company invoices" ON invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
    )
  );
```

---

## MVP Scope

### In Scope ✅

- Supabase authentication (email/password)
- Company creation and user assignment
- Sales and Purchases invoice list views
- Search by vendor/customer name
- Filter by date range and amount range
- Manual invoice creation form
- Demo invoice generator
- Basic responsive design

### Out of Scope (Future) ❌

- KSeF API integration
- Invoice detail view / PDF preview
- Invoice editing/deletion
- Multi-currency support
- Export functionality
- Email notifications
- User invitation system
- Mobile app

---

## Success Metrics

| Metric                                         | Target       |
| ---------------------------------------------- | ------------ |
| Time to find invoice                           | < 10 seconds |
| Page load time                                 | < 2 seconds  |
| User can create account and view demo invoices | < 3 minutes  |

---

## Development Phases

**Phase 1 (Week 1):** Auth + Company setup + Database schema  
**Phase 2 (Week 2):** Invoice list views + Demo generator  
**Phase 3 (Week 3):** Search & filtering + Manual invoice creation  
**Phase 4 (Week 4):** Polish UI + Testing + Deploy

---

Want me to save this as a document, or shall we dive into any specific section—like the database schema, UI components, or authentication flow?
