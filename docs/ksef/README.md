# KSeF Integration Reference

This folder contains documentation for the KSeF (Krajowy System e-Faktur) integration in Filbert.

## What is KSeF?

KSeF is the Polish National e-Invoice System operated by the Ministry of Finance. It requires businesses to submit invoices electronically in a standardized XML format (FA schema).

## Documentation

| Document                                                | Description                               |
| ------------------------------------------------------- | ----------------------------------------- |
| [API_REFERENCE.md](./API_REFERENCE.md)                  | API endpoints, authentication, operations |
| [FA3_FIELD_MAPPING.md](./FA3_FIELD_MAPPING.md)          | Invoice XML field mappings                |
| [schemat_FA(3)\_v1-0E.xsd](<./schemat_FA(3)_v1-0E.xsd>) | Official XSD schema                       |

## Quick Start

### Authentication Flow

```
1. Get challenge     → POST /v2/auth/challenge
2. Encrypt token     → RSA-OAEP with KSeF public key
3. Submit token      → POST /v2/auth/ksef-token
4. Poll for status   → GET /v2/auth/{referenceNumber}
5. Redeem tokens     → POST /v2/auth/token/redeem
```

### Sending an Invoice

```
1. Authenticate (if not already)
2. Open session      → POST /v2/sessions/online
3. Send invoice XML  → POST /v2/sessions/online/{session}/invoices
4. Close session     → POST /v2/sessions/online/{session}/close
```

### Fetching Invoices

```
1. Authenticate
2. Query metadata    → POST /v2/invoices/query/metadata
3. Download XML      → GET /v2/invoices/ksef/{ksefReference}
```

## Environments

| Environment | Base URL                          | Purpose             |
| ----------- | --------------------------------- | ------------------- |
| Test        | `https://api-test.ksef.mf.gov.pl` | Development testing |
| Demo        | `https://api-demo.ksef.mf.gov.pl` | Demo/staging        |
| Prod        | `https://api.ksef.mf.gov.pl`      | Production          |

## Key Files in Codebase

| File                             | Purpose                |
| -------------------------------- | ---------------------- |
| `lib/ksef/api-client.ts`         | Main API client        |
| `lib/ksef/auth.ts`               | Authentication logic   |
| `lib/ksef/crypto.ts`             | RSA encryption         |
| `lib/ksef/xades.ts`              | XML digital signatures |
| `lib/ksef/fa3-xml-builder.ts`    | Invoice XML generation |
| `lib/ksef/fa3-xml-parser.ts`     | Invoice XML parsing    |
| `lib/ksef/certificate-crypto.ts` | Certificate handling   |

## Common Error Codes

| Error              | Meaning                     |
| ------------------ | --------------------------- |
| `AUTH_TIMEOUT`     | Polling took > 2 minutes    |
| `CHALLENGE_FAILED` | API didn't return challenge |
| `SEND_FAILED`      | Invoice XML rejected        |
| `SESSION_REQUIRED` | No active session for send  |

See [API_REFERENCE.md](./API_REFERENCE.md) for detailed error handling.
