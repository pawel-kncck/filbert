# Filbert - Product Requirements Document

## Overview

**Product Name:** Filbert
**Version:** 2.0
**Target Market:** Polish businesses managing invoices through KSeF
**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (Auth + PostgreSQL)

---

## Problem Statement

Polish companies need a simple, clean interface to view, search, and manage their invoices. With the mandatory KSeF (National e-Invoice System) integration, businesses need tools that seamlessly connect to KSeF for sending and receiving invoices while providing powerful search and filtering capabilities.

---

## User Personas

### Primary User

Small to medium business owner or accountant in Poland who needs to:

- Quickly find and review invoices
- Send sales invoices to KSeF
- Import purchase invoices from KSeF
- Manage customers and vendors

### Key Needs

- Fast access to sales and purchase invoices
- Powerful search and filtering
- KSeF integration (send/receive)
- Clean, distraction-free interface
- Multi-language support (Polish/English)

---

## Core Features

### 1. Authentication & User Management

| Feature            | Status | Description                                   |
| ------------------ | ------ | --------------------------------------------- |
| Sign Up            | Done   | Email/password registration via Supabase Auth |
| Sign In            | Done   | Email/password login                          |
| Password Reset     | Done   | Email-based recovery flow                     |
| Session Management | Done   | Persistent sessions with secure cookies       |

### 2. Company Management

| Feature          | Status | Description                         |
| ---------------- | ------ | ----------------------------------- |
| Create Company   | Done   | With NIP validation and GUS lookup  |
| Join Company     | Done   | Via NIP (pending admin approval)    |
| Switch Company   | Done   | Multi-company support with selector |
| Company Settings | Done   | Admin-only configuration            |
| Delete Company   | Done   | With confirmation dialog            |

**User-Company Relationship:**

- Many-to-many (user can belong to multiple companies)
- Roles: `admin` | `member` | `viewer`
- Pending approval flow for new members

### 3. Invoice Management

| Feature               | Status | Description                       |
| --------------------- | ------ | --------------------------------- |
| Sales Invoice List    | Done   | Paginated, searchable, filterable |
| Purchase Invoice List | Done   | Same capabilities                 |
| Invoice Details       | Done   | Full view with items              |
| Create Sales Invoice  | Done   | With line items and validation    |
| Copy Invoice          | Done   | Prefill from existing             |
| CSV Export            | Done   | With current filters              |

**Invoice Data Model:**

```
Invoice {
  id, company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency,
  ksef_reference, ksef_status, ksef_error, ksef_xml,
  source: 'manual' | 'demo' | 'ksef'
}

InvoiceItem {
  id, invoice_id, position, description,
  quantity, unit, unit_price, vat_rate,
  net_amount, vat_amount, gross_amount
}
```

### 4. KSeF Integration

| Feature                    | Status | Description                            |
| -------------------------- | ------ | -------------------------------------- |
| Token Authentication       | Done   | Challenge-response with RSA encryption |
| Certificate Authentication | Done   | XAdES-signed requests                  |
| Send Invoice               | Done   | With status tracking                   |
| Fetch Invoices             | Done   | By date range with XML import          |
| Status Tracking            | Done   | Badges and error display               |
| XML Viewer                 | Done   | Debug access to raw XML                |

### 5. Contact Management

| Feature            | Status | Description                       |
| ------------------ | ------ | --------------------------------- |
| Vendors List       | Done   | CRUD with search/pagination       |
| Customers List     | Done   | CRUD with "Create Invoice" action |
| NIP Lookup (GUS)   | Done   | Auto-populate from registry       |
| Sync from Invoices | Done   | Import missing contacts           |

### 6. Team Management

| Feature        | Status | Description                    |
| -------------- | ------ | ------------------------------ |
| View Members   | Done   | List with roles and status     |
| Approve/Reject | Done   | For pending members            |
| Change Role    | Done   | Admin can modify roles         |
| Remove Member  | Done   | With protection for last admin |

### 7. Internationalization

| Feature           | Status | Description      |
| ----------------- | ------ | ---------------- |
| Polish (default)  | Done   | Full translation |
| English           | Done   | Full translation |
| Language Switcher | Done   | In header        |

---

## UI/UX Specifications

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Logo        [Company ▼]              [EN/PL] [User ▼]   │
├─────────┬────────────────────────────────────────────────┤
│         │                                                │
│ Invoices│   [Search...]  [Date From] [Date To] [Clear]   │
│  Sales  │                                                │
│  Purch. │   ┌─────────────────────────────────────────┐  │
│  + New  │   │ Invoice List Table                      │  │
│         │   │                                         │  │
│ Settings│   │                                         │  │
│  Company│   └─────────────────────────────────────────┘  │
│  Members│                                                │
│  Vendors│   [◀ 1 2 3 ... 10 ▶]                          │
│  Custom.│                                                │
└─────────┴────────────────────────────────────────────────┘
```

### Color Palette

Using Tailwind zinc palette for consistency:

| Element        | Light    | Dark     |
| -------------- | -------- | -------- |
| Background     | white    | zinc-950 |
| Sidebar        | zinc-50  | zinc-900 |
| Text Primary   | zinc-900 | zinc-100 |
| Text Secondary | zinc-600 | zinc-400 |
| Border         | zinc-200 | zinc-800 |
| Primary Action | blue-600 | blue-500 |

---

## Technical Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

### Key Patterns

- **Server Components** for data fetching
- **Client Components** for interactivity
- **API Routes** for mutations
- **React Context** for company selection
- **URL params** for filters

### Database (Supabase/PostgreSQL)

Main tables:

- `companies` - Company info with NIP
- `user_companies` - User-company relationships with roles
- `invoices` - Invoice records
- `invoice_items` - Line items
- `vendors` - Vendor contacts
- `customers` - Customer contacts
- `company_ksef_credentials` - KSeF authentication data

All tables have Row Level Security (RLS) policies.

---

## Future Enhancements

### Phase 10: Single-Record Invoice Model

Refactor to store each invoice once (not duplicated per company), enabling automatic cross-company visibility.

### Phase 6: Dashboard & Analytics

- Summary cards (totals, trends)
- Monthly charts
- Top vendors/customers

### Phase 9: Notifications & Audit

- Email notifications
- In-app notifications
- Audit logging

---

## Success Metrics

| Metric                 | Target       |
| ---------------------- | ------------ |
| Time to find invoice   | < 10 seconds |
| Page load time         | < 2 seconds  |
| KSeF send success rate | > 95%        |
| User onboarding time   | < 3 minutes  |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Codebase architecture
- [CONVENTIONS.md](./CONVENTIONS.md) - Coding standards
- [ROADMAP.md](./ROADMAP.md) - Implementation roadmap
- [testing/USER_FLOWS.md](./testing/USER_FLOWS.md) - E2E test flows
- [ksef/](./ksef/) - KSeF integration reference
