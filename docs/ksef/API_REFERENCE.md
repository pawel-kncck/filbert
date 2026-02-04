# KSeF API Reference

This document provides a quick reference for the KSeF v2 API as implemented in Filbert.

---

## Base URLs

| Environment | URL                               |
| ----------- | --------------------------------- |
| Test        | `https://api-test.ksef.mf.gov.pl` |
| Demo        | `https://api-demo.ksef.mf.gov.pl` |
| Prod        | `https://api.ksef.mf.gov.pl`      |

---

## Authentication Endpoints

### Get Challenge

```http
POST /v2/auth/challenge
Content-Type: application/json

{
  "identifier": { "type": "NIP", "value": "1234567890" }
}
```

**Response:**

```json
{
  "challenge": "base64-encoded-challenge",
  "timestampMs": 1706789012345
}
```

---

### Submit Token

```http
POST /v2/auth/ksef-token
Content-Type: application/json

{
  "challenge": "from-previous-step",
  "identifier": { "type": "NIP", "value": "1234567890" },
  "encryptedToken": "RSA-OAEP encrypted {token}|{timestampMs}"
}
```

**Response:**

```json
{
  "referenceNumber": "uuid",
  "authenticationToken": "temporary-bearer-token"
}
```

---

### Poll Authentication Status

```http
GET /v2/auth/{referenceNumber}
Authorization: Bearer {authenticationToken}
```

**Response (pending):**

```json
{
  "processingCode": 100,
  "processingDescription": "Processing"
}
```

**Response (complete):**

```json
{
  "processingCode": 200,
  "completed": true
}
```

---

### Redeem Tokens

```http
POST /v2/auth/token/redeem
Authorization: Bearer {authenticationToken}
Content-Type: application/json

{
  "referenceNumber": "uuid-from-submit"
}
```

**Response:**

```json
{
  "accessToken": {
    "token": "jwt-access-token",
    "expiresAt": "2024-02-01T12:00:00Z"
  },
  "refreshToken": {
    "token": "jwt-refresh-token",
    "expiresAt": "2024-02-01T14:00:00Z"
  }
}
```

---

### Get Public Key (for encryption)

```http
GET /v2/security/public-key-certificates
```

**Response:**

```json
{
  "publicKey": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
}
```

---

## Session Endpoints

### Open Session

```http
POST /v2/sessions/online
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "context": {
    "identifier": { "type": "NIP", "value": "1234567890" }
  }
}
```

**Response:**

```json
{
  "referenceNumber": "session-reference-uuid"
}
```

---

### Close Session

```http
POST /v2/sessions/online/{sessionRef}/close
Authorization: Bearer {accessToken}
```

---

## Invoice Endpoints

### Send Invoice

```http
POST /v2/sessions/online/{sessionRef}/invoices
Authorization: Bearer {accessToken}
Content-Type: application/octet-stream

{FA(3) XML binary}
```

**Response:**

```json
{
  "elementReferenceNumber": "invoice-uuid",
  "referenceNumber": "session-uuid",
  "processingCode": 200,
  "processingDescription": "OK"
}
```

---

### Get Invoice Status

```http
GET /v2/sessions/{sessionRef}/invoices/{invoiceRef}
Authorization: Bearer {accessToken}
```

**Response:**

```json
{
  "invoiceStatus": 200,
  "ksefReferenceNumber": "KSeF-unique-id",
  "acquisitionTimestamp": "2024-02-01T10:00:00Z"
}
```

---

### Query Invoices (Metadata)

```http
POST /v2/invoices/query/metadata
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "subjectType": "Subject1",
  "dateRange": {
    "dateType": "Invoicing",
    "from": "2024-01-01T00:00:00.000+00:00",
    "to": "2024-01-31T23:59:59.000+00:00"
  }
}
```

**Subject Types:**

- `Subject1` - Seller (sales invoices)
- `Subject2` - Buyer (purchase invoices)

**Response:**

```json
{
  "invoices": [
    {
      "ksefNumber": "KSeF-reference",
      "invoiceNumber": "FV/2024/001",
      "invoicingDate": "2024-01-15",
      "seller": { "name": "Company A", "nip": "1234567890" },
      "buyer": { "name": "Company B", "nip": "0987654321" },
      "grossValue": 12300.0
    }
  ]
}
```

---

### Download Invoice XML

```http
GET /v2/invoices/ksef/{ksefReferenceNumber}
Authorization: Bearer {accessToken}
```

**Response:** FA(3) XML document

---

## Token Encryption

The KSeF token must be encrypted before submission:

```typescript
// 1. Format: {token}|{timestampMs}
const plaintext = `${token}|${timestampMs}`

// 2. Encrypt with RSA-OAEP
// - Algorithm: RSA-OAEP
// - Hash: SHA-256
// - MGF: MGF1 with SHA-256
// - Key: KSeF public key (from /v2/security/public-key-certificates)

// 3. Base64 encode the ciphertext
const encryptedToken = base64Encode(ciphertext)
```

**Implementation:** See `lib/ksef/crypto.ts`

---

## Certificate Authentication

Alternative to token auth using qualified certificates:

```http
POST /v2/auth/certificate
Content-Type: application/xml

{XAdES-signed InitRequest XML}
```

The request must be signed with XAdES-BES enveloped signature.

**Implementation:** See `lib/ksef/xades.ts`

---

## Error Handling

### HTTP Status Codes

| Status | Meaning                              |
| ------ | ------------------------------------ |
| 200    | Success                              |
| 400    | Bad request (validation error)       |
| 401    | Unauthorized (invalid/expired token) |
| 403    | Forbidden (no access to resource)    |
| 404    | Not found                            |
| 422    | Unprocessable entity                 |
| 500    | Server error                         |

### Processing Codes

| Code | Meaning      |
| ---- | ------------ |
| 100  | Processing   |
| 200  | Success      |
| 4xx  | Client error |
| 5xx  | Server error |

### Common Errors

| Scenario        | Response                                             |
| --------------- | ---------------------------------------------------- |
| Invalid NIP     | `{ "code": "...", "message": "Invalid identifier" }` |
| Expired token   | 401 Unauthorized                                     |
| Invalid XML     | 422 with validation details                          |
| Session expired | 401 or specific error                                |

---

## Codebase Reference

| Task                 | File                             |
| -------------------- | -------------------------------- |
| Create API client    | `lib/ksef/api-client.ts`         |
| Token encryption     | `lib/ksef/crypto.ts`             |
| Certificate signing  | `lib/ksef/xades.ts`              |
| Build invoice XML    | `lib/ksef/fa3-xml-builder.ts`    |
| Parse invoice XML    | `lib/ksef/fa3-xml-parser.ts`     |
| Certificate handling | `lib/ksef/certificate-crypto.ts` |

---

## Usage Example

```typescript
import { KsefApiClient } from '@/lib/ksef/api-client'

// 1. Create client
const client = new KsefApiClient('test')

// 2. Authenticate
await client.authenticate('1234567890', 'your-ksef-token')

// 3. Open session
const sessionRef = await client.openSession()

// 4. Send invoice
const result = await client.sendInvoice(invoiceXml)

// 5. Close session
await client.closeSession()
```
