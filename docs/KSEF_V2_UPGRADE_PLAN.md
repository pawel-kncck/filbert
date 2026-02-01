# KSeF v2 Integration Upgrade Plan

Production-ready upgrade of Filbert's KSeF integration, based on analysis of the official CIRFMF reference implementations (`ksef-client-csharp`, `ksef-client-java`, `ksef-docs`, `ksef-latarnia`, `ksef-pdf-generator`).

## Current State

The existing integration in `lib/ksef/` targets KSeF v1 endpoints (`/online/Session/InitSigned`, `/online/Invoice/Send`, etc.) with simple Bearer token authentication. It supports sending FA(3) invoices, polling for status, bulk importing, and QR code generation. This works for test/demo but is not production-grade.

### What works today

- FA(3) XML building (`lib/ksef/fa3-xml-builder.ts`) and parsing (`lib/ksef/fa3-xml-parser.ts`)
- Invoice send, status poll, and bulk fetch (`app/api/invoices/[id]/ksef/send/route.ts`, `status/route.ts`, `fetch/route.ts`)
- QR code generation with correct KOD I format (`lib/ksef/generate-qr-data.ts`)
- Credential storage per company (`company_ksef_credentials` table)
- Zod-based invoice validation (`lib/validations/ksef-fa3.ts`)

---

## Phase 1: Production-Grade Authentication

**Goal:** Replace Bearer token auth with proper KSeF token encryption (RSA-OAEP SHA-256) and implement the full v2 auth flow.

**Why this is the blocker:** KSeF production requires encrypted token exchange. The current Bearer token approach will be rejected.

### 1.1 Create crypto utility module

Create `lib/ksef/crypto.ts` using Node.js built-in `node:crypto` (no new dependencies needed).

Implement:

```typescript
// Encrypt KSeF token with RSA-OAEP SHA-256 using KSeF's public key certificate
function encryptKsefToken(token: string, timestampMs: number, publicKeyPem: string): string

// Parse X.509 PEM certificate and extract RSA public key
function extractPublicKeyFromCert(pemCertificate: string): string
```

**Encryption algorithm details** (from CIRFMF reference):

- Padding: RSA-OAEP
- Hash: SHA-256
- MGF: MGF1 with SHA-256
- Plaintext format: `{ksefToken}|{timestampMs}` encoded as UTF-8
- Output: Base64-encoded ciphertext

Node.js implementation uses `crypto.publicEncrypt()` with `constants.RSA_PKCS1_OAEP_PADDING` and `oaepHash: 'sha256'`.

### 1.2 Add KSeF public key fetching and caching

Extend `lib/ksef/api-client.ts` or create `lib/ksef/auth.ts`.

New unauthenticated endpoint:

```
GET /v2/security/public-key-certificates
```

Response contains PEM certificates with `usage` flags:

- `SymmetricKeyEncryption` — for AES key encryption in batch sessions (not needed yet)
- `KsefTokenEncryption` — for encrypting tokens during auth

Cache the `KsefTokenEncryption` certificate in memory. Refresh when the certificate's `NotAfter` date approaches (1 day before expiry). The CIRFMF C# client uses a max revalidation interval of 24 hours with 0-5 minute jitter.

### 1.3 Implement the v2 auth flow

The full authentication sequence has 6 steps:

| Step | Endpoint                      | Description                                                  |
| ---- | ----------------------------- | ------------------------------------------------------------ |
| 1    | `POST /auth/challenge`        | Get challenge string + timestamp (valid 10 min)              |
| 2    | —                             | Build `{token}\|{timestampMs}` and encrypt with RSA-OAEP     |
| 3    | `POST /auth/ksef-token`       | Submit encrypted token + challenge + NIP                     |
| 4    | `GET /auth/{referenceNumber}` | Poll auth status (1s interval, 2 min timeout)                |
| 5    | `POST /auth/token/redeem`     | Exchange for accessToken + refreshToken (one-time call)      |
| 6    | —                             | Use accessToken as `Authorization: Bearer` for all API calls |

**Request body for step 3:**

```json
{
  "challenge": "<challenge string from step 1>",
  "contextIdentifier": {
    "type": "nip",
    "value": "1234567890"
  },
  "encryptedToken": "<base64 encrypted token from step 2>",
  "authorizationPolicy": null
}
```

**Auth status codes (step 4):**

- `100` — Processing (keep polling)
- `200` — AuthenticationSuccess (proceed to redeem)
- `4xx` — Client error (throw)

**Step 5 returns:**

- `accessToken` — JWT, short-lived (~15 min, check `exp` claim)
- `refreshToken` — valid up to 7 days, used to get new accessTokens

**Critical:** `/auth/token/redeem` can only be called **once** per `authenticationToken`. A second call returns HTTP 400.

### 1.4 Update the API client

Refactor `lib/ksef/api-client.ts`:

- Replace `initSession()` with the new auth flow from 1.3
- Store `accessToken`, `refreshToken`, and `accessTokenExp` as instance state
- Replace the `SessionToken` header with standard `Authorization: Bearer {accessToken}`
- Update all endpoint paths from v1 (`/online/*`) to v2 (`/v2/*`)
- Update the base URLs:

| Environment | Current                           | New                               |
| ----------- | --------------------------------- | --------------------------------- |
| test        | `https://ksef-test.mf.gov.pl/api` | `https://api-test.ksef.mf.gov.pl` |
| demo        | `https://ksef-demo.mf.gov.pl/api` | `https://api-demo.ksef.mf.gov.pl` |
| prod        | `https://ksef.mf.gov.pl/api`      | `https://api.ksef.mf.gov.pl`      |

### 1.5 Update v2 endpoint paths

Map the current v1 endpoints to their v2 equivalents:

| Operation      | Current v1 path                     | New v2 path                             |
| -------------- | ----------------------------------- | --------------------------------------- |
| Open session   | `POST /online/Session/InitSigned`   | `POST /sessions/online`                 |
| Send invoice   | `PUT /online/Invoice/Send`          | `POST /sessions/online/{ref}/invoices`  |
| Close session  | `GET /online/Session/Terminate`     | `POST /sessions/online/{ref}/close`     |
| Invoice status | `GET /online/Invoice/Status/{ref}`  | `GET /sessions/{ref}/invoices/{invRef}` |
| Fetch invoices | `POST /online/Query/Invoice/Sync`   | `POST /invoices/query/metadata`         |
| Get invoice    | `GET /online/Invoice/Get/{ksefNum}` | `GET /invoices/ksef/{ksefNumber}`       |

### 1.6 Database migration

Update `company_ksef_credentials` to store the refresh token alongside the KSeF token:

```sql
ALTER TABLE company_ksef_credentials
  ADD COLUMN refresh_token TEXT,
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ;
```

The KSeF token (permanent secret) is still needed for re-authentication. The refresh token (7-day TTL) avoids repeating the full auth flow on every request.

### Files to create/modify

| File                                                 | Action                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `lib/ksef/crypto.ts`                                 | **Create** — RSA-OAEP encryption, cert parsing          |
| `lib/ksef/api-client.ts`                             | **Modify** — new auth flow, v2 endpoints, token refresh |
| `lib/data/ksef.ts`                                   | **Modify** — add refresh token read/write               |
| `supabase/migrations/YYYYMMDD_add_refresh_token.sql` | **Create** — migration for refresh_token columns        |
| `app/api/invoices/[id]/ksef/send/route.ts`           | **Modify** — adapt to new client API                    |
| `app/api/invoices/[id]/ksef/status/route.ts`         | **Modify** — adapt to new client API                    |
| `app/api/companies/[companyId]/ksef/fetch/route.ts`  | **Modify** — adapt to new client API                    |

---

## Phase 2: Session Robustness

**Goal:** Handle token expiration, automatic refresh, and error recovery so that long-running operations don't fail mid-flight.

### 2.1 Automatic access token refresh

Before every API call, check if `accessToken` is expired or about to expire (within 60 seconds of `exp`). If so, call:

```
POST /auth/token/refresh
Authorization: Bearer {refreshToken}
```

This returns a new `accessToken`. The `refreshToken` itself stays valid.

Implement this as a private `ensureValidToken()` method on the client, called at the start of every public method.

### 2.2 Retry on 401

If any API call returns HTTP 401:

1. Attempt token refresh
2. If refresh succeeds, retry the original request once
3. If refresh fails (refresh token also expired), re-authenticate from scratch using stored KSeF token
4. If re-auth also fails, throw `KsefApiError` with code `AUTH_FAILED`

### 2.3 Session lifecycle management

Add methods:

```typescript
// List active sessions for the current NIP
async listActiveSessions(): Promise<Session[]>

// Revoke the current session (invalidates refresh token)
async revokeCurrentSession(): Promise<void>
```

These map to:

- `GET /auth/sessions`
- `DELETE /auth/sessions/current`

### 2.4 Persist refresh token across requests

Currently the KSeF client is instantiated per-request in each API route. To benefit from refresh tokens:

Option A (simpler): Store `refreshToken` + `refreshTokenExpiresAt` in the database. On each request, create the client, load the refresh token, and skip the full auth flow if the refresh token is still valid. Falls back to full auth if expired.

Option B (more complex): Use a singleton/cached client per company. More efficient but requires careful memory management in a serverless environment.

**Recommendation:** Option A. It's stateless, works in serverless, and the refresh call is fast (single HTTP request vs. 5 requests for full auth).

### Files to modify

| File                                                      | Action                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `lib/ksef/api-client.ts`                                  | **Modify** — add `ensureValidToken()`, retry logic, session methods |
| `lib/data/ksef.ts`                                        | **Modify** — read/write refresh token from DB                       |
| `app/api/companies/[companyId]/ksef-credentials/route.ts` | **Modify** — clear refresh token on credential delete               |

---

## Phase 3: Lighthouse (KSeF Status Indicator)

**Goal:** Show users whether KSeF is available, under maintenance, or experiencing an outage before they attempt to send invoices.

### 3.1 Lighthouse API client

Create `lib/ksef/lighthouse.ts`. Two unauthenticated endpoints:

**`GET /status`**

```typescript
interface LighthouseStatus {
  status: 'AVAILABLE' | 'MAINTENANCE' | 'FAILURE' | 'TOTAL_FAILURE'
  messages?: LighthouseMessage[]
}
```

**`GET /messages`** (retained 30 days, sorted descending by `published`)

```typescript
interface LighthouseMessage {
  id: string // e.g. "K/2026/NI/01"
  eventId: number // groups related messages
  category: 'FAILURE' | 'TOTAL_FAILURE' | 'MAINTENANCE'
  type: 'FAILURE_START' | 'FAILURE_END' | 'MAINTENANCE_ANNOUNCEMENT'
  title: string // max 80 chars
  text: string // max 3000 chars
  start: string // ISO 8601
  end?: string // ISO 8601, absent for ongoing failures
  version: number
  published: string // ISO 8601
}
```

Environment URLs:

- test: `https://api-latarnia-test.ksef.mf.gov.pl/`
- prod: `https://api-latarnia.ksef.mf.gov.pl/`

### 3.2 API route

Create `app/api/companies/[companyId]/ksef/status/route.ts` (GET).

Reads the company's KSeF environment and fetches the corresponding Lighthouse status. Cache the response for 60 seconds (use Next.js `revalidate` or a simple in-memory TTL cache) to avoid hammering the endpoint.

### 3.3 UI component

Create a `KsefStatusIndicator` component. Display options:

- Green dot + "KSeF available" when `AVAILABLE`
- Yellow dot + "Planned maintenance" with start/end times for `MAINTENANCE`
- Red dot + "KSeF unavailable" for `FAILURE` or `TOTAL_FAILURE`

Place it in the KSeF credentials section of company settings and near the KSeF send button on invoice detail pages. When status is not `AVAILABLE`, disable the send button and show the reason.

### Files to create/modify

| File                                                       | Action                                     |
| ---------------------------------------------------------- | ------------------------------------------ |
| `lib/ksef/lighthouse.ts`                                   | **Create** — Lighthouse API client + types |
| `app/api/companies/[companyId]/ksef/status/route.ts`       | **Create** — API route with caching        |
| `components/ksef-status-indicator.tsx`                     | **Create** — status display component      |
| `components/invoices/ksef-send-button.tsx`                 | **Modify** — disable when KSeF unavailable |
| `components/company-settings/ksef-credentials-section.tsx` | **Modify** — show status indicator         |

---

## Phase 4: PDF Generation from KSeF XML

**Goal:** Generate official-looking PDF invoices from KSeF XML data using the Ministry of Finance's own library.

### 4.1 Evaluate `@akmf/ksef-fe-invoice-converter`

The CIRFMF `ksef-pdf-generator` repo provides a TypeScript library (`@akmf/ksef-fe-invoice-converter`) that generates PDFs from FA(1)/FA(2)/FA(3) XML and UPO v4.3 XML. It uses `pdfmake` and `xml-js`.

**Caveats:**

- Not published to npm — must be installed from GitHub or vendored
- Primary API uses browser `File` object: `generateInvoice(file: File, additionalData, formatType)`
- Individual generators (`generateFA3()`) accept parsed objects directly and are usable server-side
- Requires Node.js 22+ (Filbert should verify its Node version)

### 4.2 Installation approach

```bash
npm install github:CIRFMF/ksef-pdf-generator
```

Or clone and reference locally if the above doesn't resolve cleanly due to the monorepo structure. Alternatively, vendor the built output (`dist/`) into `lib/ksef/pdf/`.

### 4.3 Integration

Create `lib/ksef/pdf.ts` that wraps the library:

```typescript
// Generate PDF blob from KSeF invoice XML
async function generateInvoicePdf(
  invoiceXml: string,
  ksefNumber: string,
  qrCodeData?: string
): Promise<Buffer>
```

Use `generateFA3()` directly with parsed XML data for server-side rendering, bypassing the browser `File` API.

### 4.4 API route and UI

Create `app/api/invoices/[id]/ksef/pdf/route.ts` (GET) that:

1. Fetches the invoice's KSeF XML (stored or re-downloaded)
2. Generates PDF using the wrapper
3. Returns `Content-Type: application/pdf`

Add a "Download PDF" button next to the existing KSeF preview button in the invoice detail view.

### Files to create/modify

| File                                                     | Action                                         |
| -------------------------------------------------------- | ---------------------------------------------- |
| `lib/ksef/pdf.ts`                                        | **Create** — wrapper around ksef-pdf-generator |
| `app/api/invoices/[id]/ksef/pdf/route.ts`                | **Create** — PDF download endpoint             |
| `components/invoices/ksef-pdf-button.tsx`                | **Create** — download button                   |
| `components/invoices/invoice-detail.tsx` (or equivalent) | **Modify** — add PDF button                    |

---

## Phase 5: Future Considerations (Not In Scope Now)

These are documented for awareness but should not be built until there's a concrete need.

### 5.1 XAdES signature authentication

Required if Filbert needs to support authentication via qualified certificates (e.g., company seals) instead of KSeF tokens. Would need `xml-crypto` or similar library. Only needed if customers don't have KSeF tokens.

### 5.2 Batch sessions

For bulk invoice submission (hundreds/thousands at once). Uses AES-encrypted invoice payloads with the `SymmetricKeyEncryption` public key. The current per-invoice online session approach is fine for typical volumes.

### 5.3 Permissions management

Full CRUD for 7 permission types (persons, entities, EU entities, proxies, subunits, indirect, authorizations). Only needed if Filbert manages KSeF permissions on behalf of users rather than having them set up permissions in the KSeF portal directly.

### 5.4 KSeF token lifecycle management

Generating, listing, and revoking KSeF tokens from within Filbert. Currently users create tokens in the KSeF portal and paste them into Filbert. Self-service token management is a convenience feature.

### 5.5 Package extraction

If the `lib/ksef/` module grows clean and stable after phases 1-2, consider extracting it into a standalone `@filbert/ksef-client` npm package. There is no official JS/TS KSeF client — this could serve the Polish developer community. Evaluate after production usage validates the implementation.

---

## Dependencies Summary

| Dependency                                      | Phase | Why                 |
| ----------------------------------------------- | ----- | ------------------- |
| `node:crypto` (built-in)                        | 1     | RSA-OAEP encryption |
| `@akmf/ksef-fe-invoice-converter` (from GitHub) | 4     | PDF generation      |
| No other new dependencies needed                | —     | —                   |

## Testing Strategy

- **Phase 1-2:** Test against the KSeF **test** environment (`api-test.ksef.mf.gov.pl`) which accepts self-signed certificates and test NIP numbers. CIRFMF provides test data endpoints (`/testdata/*`) for generating test subjects and permissions.
- **Phase 3:** Lighthouse test environment (`api-latarnia-test.ksef.mf.gov.pl`) is publicly available.
- **Phase 4:** Unit test PDF generation with sample FA(3) XML fixtures.

## Reference Material

- [CIRFMF/ksef-docs](https://github.com/CIRFMF/ksef-docs) — complete KSeF 2.0 integration guide + OpenAPI spec + XSD schemas
- [CIRFMF/ksef-client-csharp](https://github.com/CIRFMF/ksef-client-csharp) — C# reference implementation (auth flow in `AuthCoordinator.cs`, crypto in `CryptographyService.cs`, routes in `Routes.cs`)
- [CIRFMF/ksef-client-java](https://github.com/CIRFMF/ksef-client-java) — Java reference implementation (routes in `Url.java`, crypto in `DefaultCryptographyService.java`)
- [CIRFMF/ksef-latarnia](https://github.com/CIRFMF/ksef-latarnia) — Lighthouse OpenAPI spec
- [CIRFMF/ksef-pdf-generator](https://github.com/CIRFMF/ksef-pdf-generator) — TypeScript PDF generator
