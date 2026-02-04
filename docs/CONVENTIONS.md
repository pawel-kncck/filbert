# Coding Conventions

This document defines the coding standards and patterns used in Filbert. Follow these conventions to maintain consistency.

---

## File Naming

| Type              | Convention           | Example                     |
| ----------------- | -------------------- | --------------------------- |
| React components  | `kebab-case.tsx`     | `invoice-table.tsx`         |
| Utility functions | `kebab-case.ts`      | `format-currency.ts`        |
| React hooks       | `use-*.ts`           | `use-filter-params.ts`      |
| Types/interfaces  | `kebab-case.ts`      | `database.ts`               |
| API routes        | `route.ts` in folder | `app/api/invoices/route.ts` |
| Pages             | `page.tsx` in folder | `app/sales/page.tsx`        |

---

## Component Naming

| Type        | Convention         | Example             |
| ----------- | ------------------ | ------------------- |
| Components  | PascalCase         | `InvoiceTable`      |
| Props types | `{Component}Props` | `InvoiceTableProps` |
| Context     | `{Name}Context`    | `CompanyContext`    |
| Provider    | `{Name}Provider`   | `CompanyProvider`   |
| Hook        | `use{Name}`        | `useCompany`        |

---

## Directory Organization

### Components

Group by feature, not by type:

```
components/
├── invoices/           # All invoice-related components
│   ├── invoice-table.tsx
│   ├── invoice-form.tsx
│   ├── invoice-filters.tsx
│   └── invoice-row.tsx
├── customers/          # Customer components
├── vendors/            # Vendor components
└── ui/                 # Base UI primitives (shadcn/ui)
```

### When to Create New Directories

- **New feature area**: Create `components/{feature}/`
- **Shared utility used by 3+ features**: Move to `components/shared/`
- **Base UI component**: Add to `components/ui/`

---

## TypeScript Conventions

### Type Definitions

```typescript
// Prefer type over interface for object types
type Invoice = {
  id: string
  invoiceNumber: string
  // ...
}

// Use interface for extending
interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
}
```

### Props Typing

```typescript
// Define props type above component
type InvoiceTableProps = {
  invoices: Invoice[]
  type: 'sales' | 'purchase'
  onSelect?: (invoice: Invoice) => void
}

export function InvoiceTable({ invoices, type, onSelect }: InvoiceTableProps) {
  // ...
}
```

### Database Types

Always use auto-generated types from `lib/types/database.ts`:

```typescript
import type { Invoice, InvoiceInsert } from '@/lib/types/database'
```

---

## React Patterns

### Server vs Client Components

```typescript
// Server Component (default) - no directive needed
export default async function Page() {
  const data = await fetchData()
  return <ClientComponent data={data} />
}

// Client Component - requires directive
'use client'

export function ClientComponent({ data }: Props) {
  const [state, setState] = useState()
  // ...
}
```

### When to Use Client Components

Use `'use client'` when you need:

- React hooks (`useState`, `useEffect`, etc.)
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `document`, etc.)
- Third-party client libraries

### Data Fetching

```typescript
// DO: Fetch in Server Components
export default async function Page() {
  const invoices = await getInvoices(companyId, 'sales')
  return <InvoiceTable invoices={invoices} />
}

// DON'T: Fetch in Client Components with useEffect
// (unless absolutely necessary for real-time updates)
```

### Form Submission

```typescript
// Pattern: Client component with API route
'use client'

export function InvoiceForm() {
  const handleSubmit = async (data: FormData) => {
    const response = await fetch('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (response.ok) {
      router.push('/sales')
    }
  }
}
```

---

## API Route Patterns

### Standard Structure

```typescript
import { NextResponse } from 'next/server'
import { requireMemberAuth } from '@/lib/api/middleware'

export async function POST(request: Request) {
  // 1. Authentication
  const auth = await requireMemberAuth(companyId)
  if (auth instanceof NextResponse) return auth

  // 2. Parse body
  const body = await request.json()

  // 3. Validate
  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
      { status: 422 }
    )
  }

  // 4. Business logic
  const { data, error } = await auth.supabase.from('table').insert(result.data)

  // 5. Response
  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
```

### Error Response Format

```typescript
{
  error: {
    code: 'ERROR_CODE',
    message: 'Human-readable message'
  }
}
```

---

## Internationalization (i18n)

### Adding Translations

1. Add key to both `messages/pl.json` and `messages/en.json`
2. Use consistent namespace structure

```json
{
  "invoices": {
    "title": "Faktury",
    "table": {
      "number": "Numer",
      "date": "Data"
    }
  }
}
```

### Using Translations

```typescript
// Server Component
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('invoices')
  return <h1>{t('title')}</h1>
}

// Client Component
'use client'
import { useTranslations } from 'next-intl'

export function Component() {
  const t = useTranslations('invoices')
  return <span>{t('table.number')}</span>
}
```

### Namespace Conventions

| Namespace    | Content                          |
| ------------ | -------------------------------- |
| `common`     | Shared UI text (buttons, labels) |
| `invoices`   | Invoice-related text             |
| `customers`  | Customer-related text            |
| `vendors`    | Vendor-related text              |
| `settings`   | Settings pages text              |
| `auth`       | Login, signup, password reset    |
| `errors`     | Error messages                   |
| `validation` | Form validation messages         |

---

## Styling Conventions

### Tailwind CSS

Use Tailwind utility classes. Follow this order:

```tsx
<div className="
  flex items-center gap-4       /* Layout */
  p-4 mx-auto                   /* Spacing */
  w-full max-w-lg               /* Sizing */
  bg-white dark:bg-zinc-900     /* Colors */
  border rounded-lg             /* Borders */
  shadow-sm                     /* Effects */
  hover:bg-gray-50              /* States */
">
```

### Color Palette

Use zinc colors for consistency:

```tsx
// Text
text-zinc-900 dark:text-zinc-100  // Primary
text-zinc-600 dark:text-zinc-400  // Secondary
text-zinc-400 dark:text-zinc-500  // Muted

// Backgrounds
bg-white dark:bg-zinc-950         // Main
bg-zinc-50 dark:bg-zinc-900       // Subtle
bg-zinc-100 dark:bg-zinc-800      // Muted

// Borders
border-zinc-200 dark:border-zinc-800
```

### Component Styling

```tsx
// DO: Use cn() utility for conditional classes
import { cn } from '@/lib/utils'

<button className={cn(
  'px-4 py-2 rounded',
  isActive && 'bg-blue-500 text-white',
  disabled && 'opacity-50 cursor-not-allowed'
)}>

// DON'T: Use inline styles
<button style={{ padding: '16px' }}>
```

---

## Database Conventions

### Column Naming

- Use `snake_case` for column names
- Use descriptive names: `invoice_number`, not `inv_no`
- Timestamps: `created_at`, `updated_at`
- Foreign keys: `{table}_id` (e.g., `company_id`)

### Migrations

Name migrations with timestamp and description:

```
20260203000001_add_ksef_xml.sql
```

### RLS Policies

Always add Row Level Security policies for new tables:

```sql
CREATE POLICY "Users can view own company data"
  ON new_table FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
  ));
```

---

## Validation Patterns

### Zod Schemas

```typescript
// lib/validations/invoice.ts
import { z } from 'zod'

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Required'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  netAmount: z.number().positive('Must be positive'),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
```

### Validation in API Routes

```typescript
const result = createInvoiceSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', details: result.error.flatten() } },
    { status: 422 }
  )
}
// result.data is now typed
```

---

## Error Handling

### API Routes

```typescript
try {
  // operation
} catch (error) {
  console.error('[API] Operation failed:', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
    { status: 500 }
  )
}
```

### Client Components

```typescript
const [error, setError] = useState<string | null>(null)

const handleSubmit = async () => {
  setError(null)
  try {
    await submitData()
  } catch (err) {
    setError(t('errors.submitFailed'))
  }
}
```

---

## Git Conventions

### Branch Naming

```
feat/description     # New feature
fix/description      # Bug fix
docs/description     # Documentation
refactor/description # Code refactoring
```

### Commit Messages

```
feat: add invoice export functionality
fix: resolve date picker timezone issue
docs: update API documentation
refactor: simplify invoice validation logic
```

### Before Committing

```bash
npm run build        # Ensure build passes
npm run lint         # Fix linting issues
npm run i18n:validate  # Check translations
```

---

## Testing Conventions

### File Naming

```
component.test.tsx     # Unit tests
component.spec.ts      # Integration tests
e2e/flow.spec.ts       # E2E tests
```

### Test Structure

```typescript
describe('InvoiceTable', () => {
  it('renders invoice list', () => {
    // ...
  })

  it('calls onSelect when row clicked', () => {
    // ...
  })
})
```
