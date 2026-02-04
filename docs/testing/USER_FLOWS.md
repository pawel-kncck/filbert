# User Flows for Playwright Testing

This document maps all user flows in Filbert for end-to-end testing. Each flow includes starting URL, interactive elements, and expected assertions.

---

## 1. Authentication Flows

### 1.1 Login

**URL:** `/login`

**Steps:**

1. Navigate to `/login`
2. Enter email in `#email` input
3. Enter password in `#password` input
4. Click submit button (contains "Login" text)

**Assertions:**

- Success: Redirect to `/companies`
- Invalid credentials: Error message displayed (red alert box)
- Empty fields: Form validation prevents submission

**Related Links:**

- "Forgot Password?" → `/forgot-password`
- "Sign up" → `/signup`

---

### 1.2 Signup

**URL:** `/signup`

**Steps:**

1. Navigate to `/signup`
2. Enter email in `#email` input
3. Enter password in `#password` input (minimum 12 characters)
4. Enter same password in `#confirmPassword` input
5. Click submit button

**Assertions:**

- Success: Display "Check your email" confirmation message
- Password too short: Error "Password must be at least 12 characters"
- Passwords mismatch: Error "Passwords must match"
- Existing email: Supabase error displayed

---

### 1.3 Forgot Password

**URL:** `/forgot-password`

**Steps:**

1. Navigate to `/forgot-password`
2. Enter email in `#email` input
3. Click "Send reset link" button

**Assertions:**

- Success: Display "Check your email for reset instructions"
- Invalid email: Error message

---

### 1.4 Reset Password

**URL:** `/reset-password` (accessed via email link)

**Steps:**

1. Access reset link from email
2. Enter new password in `#password` input
3. Confirm password in `#confirmPassword` input
4. Click "Reset password" button

**Assertions:**

- Success: Display success message with link to app
- Expired link: Display "Link expired" with option to request new one
- Password validation: Same as signup (12 char minimum, must match)

---

### 1.5 Logout

**URL:** Any protected page

**Steps:**

1. Click logout button in top-right area (form POST to `/api/auth/logout`)

**Assertions:**

- Redirect to `/login`
- Session cleared (cannot access protected pages)

---

## 2. Invoice Flows

### 2.1 View Sales Invoice List

**URL:** `/sales` or `/sales?company={companyId}`

**Elements:**

- Company selector dropdown (top bar)
- Search input + submit button
- Date filters: "from" and "to" date inputs
- "Clear filters" button (visible when filters active)
- Pagination controls
- Invoice table rows (clickable)
- Export button
- "Create new invoice" link

**URL Parameters:**
| Param | Description |
|-------|-------------|
| `company` | Company UUID |
| `page` | Page number (default: 1) |
| `search` | Search term |
| `from` | Start date (YYYY-MM-DD) |
| `to` | End date (YYYY-MM-DD) |

**Assertions:**

- Invoice table displays with columns: Number, Date, Customer, NIP, Net, VAT, Gross
- Statistics cards show totals
- Empty state when no invoices match filters

---

### 2.2 View Purchase Invoice List

**URL:** `/purchases`

Same as 2.1 but shows vendor instead of customer.

---

### 2.3 Create Sales Invoice

**URL:** `/sales/new?company={id}`

**Query Parameters:**
| Param | Effect |
|-------|--------|
| `company` | Pre-select company |
| `copy` | Copy from invoice ID (prefills all fields) |
| `customer` | Prefill customer name/NIP |

**Form Fields:**

- Invoice number input (required)
- Issue date input (defaults to today)
- Currency dropdown (default: PLN)
- Customer name input (required)
- Customer NIP input
- NIP lookup button (GUS integration)

**Line Items Table:**
Each row has:

- Description input
- Quantity input
- Unit dropdown (szt., godz., kg, m, m²)
- Unit price input
- VAT rate dropdown (23%, 8%, 5%, 0%, zw., np.)
- Net/VAT/Gross (auto-calculated)
- Delete row button

**Actions:**

- Add item button
- Save button
- Back link

**Assertions:**

- Amounts calculate automatically as you type
- Required field validation on submit
- Success: Redirect to invoice detail page
- Copy mode: Form prefilled with source invoice data

---

### 2.4 View Invoice Details

**URL:** `/sales/{id}` or `/purchases/{id}`

**Elements:**

- Back to list link
- Invoice number heading
- KSeF Preview button (opens modal)
- KSeF Send button (sales only, if credentials configured)
- KSeF status badge (pending/accepted/rejected/error)
- Seller/Buyer info cards
- Invoice items table
- Amount summary (Net, VAT, Gross)
- Metadata (currency, source, created date)

**Assertions:**

- All invoice data displayed correctly
- KSeF reference shown if sent
- KSeF error message shown if failed
- Cannot access invoices for other companies (404)

---

### 2.5 Send Invoice to KSeF

**URL:** Sales invoice detail page

**Steps:**

1. Navigate to sales invoice detail
2. Click "Send to KSeF" button
3. Confirm in dialog

**Assertions:**

- Pre-condition: KSeF credentials configured for company
- Loading state: Button shows "Sending..."
- Success: Status badge updates, reference number displayed
- Error: Error message shown, status badge shows error
- Already sent: Send button not visible

**Error Cases:**

- No credentials: "No KSeF credentials configured"
- Auth failed: Specific error message
- Session expired: "Session failed"

---

### 2.6 Filter/Search Invoices

**URL:** `/sales` or `/purchases`

**Steps:**

1. Enter search term in search input
2. Click submit/press Enter
3. Optionally set date range
4. Clear filters button to reset

**Assertions:**

- URL updates with search params
- Results filtered by search term (matches number, name, NIP)
- Date range filters by issue_date
- Multiple filters combine
- Clear button resets all filters and URL

---

### 2.7 Export Invoices

**URL:** `/sales` or `/purchases`

**Steps:**

1. Apply desired filters
2. Click Export button

**Assertions:**

- CSV file downloads
- Filename includes company name and timestamp
- Export respects current filters

---

## 3. Company Flows

### 3.1 View Companies List

**URL:** `/companies`

**Elements:**

- Company cards grid:
  - Company name
  - NIP
  - Role badge (Admin/Member/Viewer)
  - "Demo" badge (if demo company)
  - "Open" link → `/sales?company={id}`
- "Add Company" button
- Pending approvals section (if any)

**Assertions:**

- All user's companies displayed
- Demo companies marked
- Pending memberships in separate section
- Click "Open" navigates to sales list

---

### 3.2 Create New Company (Onboarding)

**URL:** `/onboarding`

**Steps:**

1. Enter company name
2. Enter NIP (format: 123-456-78-90 or 1234567890)
3. Click "Continue"

**Assertions:**

- NIP validation: 10 digits, valid checksum
- New NIP: Company created, user becomes admin, redirect to `/companies`
- Existing NIP: User joins as pending member, redirect to `/pending`
- Invalid NIP: Error message

---

### 3.3 Switch Company

**URL:** Any protected page

**Steps:**

1. Click company selector dropdown in top bar
2. Select different company from list

**Assertions:**

- Current company shown in dropdown
- Demo badge displayed if applicable
- Selection updates:
  - Cookie set
  - Page data refreshes
  - URL updated with `?company={id}`

---

### 3.4 Company Settings

**URL:** `/settings/company?company={id}`

**Sections:**

#### Company Info (Read-only)

- Company name display
- NIP display

#### KSeF Credentials (Admin only)

**Token Method:**

- Token input (password field with show/hide)
- Environment dropdown (test/demo/prod)
- Save button

**Certificate Method:**

- Format dropdown (PKCS#12 / PEM)
- Certificate file upload
- Private key file upload (PEM only)
- Password input
- Save button

#### KSeF Fetch (Admin only, if credentials set)

- "Fetch from KSeF" button

#### Delete Company (Admin only)

- Delete button with confirmation dialog
- Requires typing company name to confirm

**Assertions:**

- Non-admin: Warning message "Only admins can modify settings"
- Demo company: "Not available for demo companies"
- Save credentials: Success message
- Delete: Confirmation required, then redirect to `/companies`

---

## 4. Contact Flows

### 4.1 Vendors List

**URL:** `/settings/vendors?company={id}`

**Elements:**

- Search input + apply button
- Vendor table: Name, NIP, Email, Address, Phone, Actions
- Pagination
- "Add vendor" button
- Missing vendors alert (if applicable)

**Per-Row Actions:**

- Show invoices → filters purchases by vendor
- Edit → opens form dialog
- Delete → confirmation dialog (admin only)

**Assertions:**

- Demo company: "Not available" message
- Search filters results
- Pagination works

---

### 4.2 Add Vendor

**URL:** Vendor list → "Add vendor" button

**Dialog Fields:**

- Name input (required)
- NIP input (optional, with validation)
- Address input
- Email input
- Phone input
- Notes textarea
- NIP lookup button

**Assertions:**

- Required field validation
- NIP lookup populates name/address from GUS
- Submit: Vendor created, table refreshes
- Cancel: Dialog closes, no changes

---

### 4.3 Edit Vendor

Same dialog as Add, prefilled with existing data.

---

### 4.4 Delete Vendor

**Steps:**

1. Click delete button (admin only)
2. Confirm in dialog

**Assertions:**

- Confirmation required
- Success: Vendor removed from list
- Non-admin: Delete button not visible

---

### 4.5 Customers List

**URL:** `/settings/customers?company={id}`

Same structure as vendors, plus:

- "Create invoice" action → navigates to `/sales/new?customer={id}`

---

### 4.6 Add/Edit/Delete Customer

Same patterns as vendor flows.

---

### 4.7 NIP Lookup (GUS)

**URL:** Any vendor/customer form dialog

**Steps:**

1. Enter NIP in NIP field
2. Click lookup button (icon)

**Assertions:**

- Valid NIP: Populates name and address from GUS database
- Invalid NIP: Error message
- Not found: "Nie znaleziono" message
- Loading state: Button shows spinner

---

## 5. Member Flows

### 5.1 View Members List

**URL:** `/settings/members?company={id}`

**Elements:**

- Members table: Email, Role, Status, Actions
- Admin warning (if current user not admin)

**Per-Row Actions (Admin only):**

- Pending members: Approve (green), Reject (red)
- Active members: Role dropdown, Remove button
- Current user: Role read-only, no remove button

**Assertions:**

- Demo company: Unavailable message
- Non-admin: No action buttons visible

---

### 5.2 Approve Member

**Steps:**

1. Find pending member row
2. Click Approve button (green)

**Assertions:**

- Status changes to active
- Buttons change to role selector
- API: POST `/api/members/{userId}/approve`

---

### 5.3 Reject Member

**Steps:**

1. Find pending member row
2. Click Reject button (red)

**Assertions:**

- Member removed from list
- API: POST `/api/members/{userId}/reject`

---

### 5.4 Change Member Role

**Steps:**

1. Find active member row
2. Click role dropdown
3. Select new role (Admin/Member/Viewer)

**Assertions:**

- Role updates immediately
- Current user's role is read-only
- API: PUT `/api/members/{userId}/role`

---

### 5.5 Remove Member

**Steps:**

1. Find active member row (not current user)
2. Click remove button (trash icon)
3. Confirm in dialog

**Assertions:**

- Confirmation required
- Member removed from list
- Cannot remove yourself
- API: DELETE `/api/members/{userId}/remove`

---

### 5.6 Pending Membership Page

**URL:** `/pending`

**Elements:**

- Company name display
- "Awaiting admin approval" message
- "Check status" button
- Logout button

**Assertions:**

- Polls for approval status
- Approved: Redirect to `/companies`
- Rejected: Message or redirect to login

---

## 6. Navigation

### 6.1 Sidebar

**Links:**
| Label | URL |
|-------|-----|
| Filbert (logo) | `/companies` |
| Sales | `/sales` |
| Purchases | `/purchases` |
| New Invoice | `/sales/new` |
| Company | `/settings/company` |
| Members | `/settings/members` |
| Vendors | `/settings/vendors` |
| Customers | `/settings/customers` |
| Companies | `/companies` |

**Assertions:**

- Active link highlighted
- All links navigate correctly

---

### 6.2 Top Bar

**Elements:**

- Company selector (left)
- Language switcher (right)
- User email (right)
- Logout button (right)

---

## 7. Error Handling

### Authentication Errors

- Invalid credentials → Error message
- Session expired → Redirect to `/login`
- Unauthorized → 403 or redirect

### Demo Company Restrictions

- Cannot create invoices → Redirect from `/sales/new`
- Settings unavailable → Info message
- Contact lists read-only

### Authorization

| Role   | Create Invoice | Edit Settings | Manage Members |
| ------ | -------------- | ------------- | -------------- |
| Admin  | Yes            | Yes           | Yes            |
| Member | Yes            | No            | No             |
| Viewer | No             | No            | No             |

### Validation

- NIP: 10 digits, valid checksum
- Email: Standard format
- Passwords: 12+ characters, must match

---

## 8. Test Data Requirements

### Demo Company

- Pre-created with sample invoices
- Used for testing read-only flows

### Test Users

- Admin user for full access tests
- Member user for limited access tests
- Viewer user for read-only tests
- Pending user for approval flow tests

### Test Invoices

- Sales invoices with various statuses
- Purchase invoices for vendor tests
- KSeF-sent invoice for status display

---

## 9. Playwright Selectors Strategy

Since the codebase doesn't use `data-testid` consistently, use these strategies:

```typescript
// By role and text
page.getByRole('button', { name: 'Login' })
page.getByRole('link', { name: 'Sales' })

// By label
page.getByLabel('Email')
page.getByLabel('Password')

// By ID
page.locator('#email')
page.locator('#password')

// By text content
page.getByText('Awaiting admin approval')

// By placeholder
page.getByPlaceholder('Search...')
```

**Recommendation:** Add `data-testid` attributes to key interactive elements for more reliable tests.
