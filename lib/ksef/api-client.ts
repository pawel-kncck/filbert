/**
 * Client for the KSeF v2 HTTP API.
 *
 * **Lifecycle.** A client is stateful and single-tenant: authenticate, use,
 * discard. Instances hold bearer tokens and a session reference, so one must
 * not be shared across companies or cached beyond a request.
 *
 * ```ts
 * const client = new KsefApiClient('prod')
 * await client.authenticate(nip, token)   // or authenticateWithCert(...)
 * await client.openSession()              // sending only
 * try { await client.sendInvoice(xml) } finally { await client.closeSession() }
 * ```
 *
 * **Sessions are only for sending.** In v2, querying and downloading invoices
 * are session-free — `authenticate()` alone suffices. Only `sendInvoice()`
 * requires `openSession()`, and each method's docs state which it needs. Both
 * preconditions are enforced, so a missing step raises `AUTH_REQUIRED` or
 * `SESSION_REQUIRED` rather than producing a confusing 401 from KSeF.
 *
 * **Errors.** Every method throws {@link KsefApiError} carrying a stable `code`
 * and the upstream `statusCode`; authentication failures surface as
 * {@link KsefAuthError} from `./auth`. Nothing here returns a null-on-failure
 * result — a KSeF call that did not do what was asked is always an exception.
 *
 * Verbose tracing is available via `KSEF_DEBUG` (see `./logger`); bearer tokens
 * are redacted even when it is on.
 *
 * @see docs/ksef/ for the integration reference.
 */
import {
  authenticateWithKsef,
  authenticateWithCertificate,
  KsefAuthError,
  type KsefAuthTokens,
} from './auth'
import { ksefDebug, ksefWarn, describeSecret, redactHeaders } from './logger'
import { V2_BASE_URLS } from './types'
export type { KsefEnvironment, KsefAuthMethod } from './types'
import type { KsefEnvironment } from './types'

/** Acknowledgement of a submitted invoice. Acceptance is confirmed separately. */
export type KsefSendResult = {
  /** Identifies this invoice within the session. */
  elementReferenceNumber: string
  /** The submission's reference number. */
  referenceNumber: string
  /** KSeF processing status at submission time; acceptance may still be pending. */
  processingCode: number
  processingDescription: string
}

/** Processing state of a previously submitted invoice. */
export type KsefInvoiceStatus = {
  invoiceStatus: number
  /** The permanent KSeF number, assigned once accepted; `null` until then. */
  ksefReferenceNumber: string | null
  /** When KSeF accepted the invoice; `null` until then. */
  acquisitionTimestamp: string | null
}

/** Filter for an invoice metadata query. */
export type KsefQueryCriteria = {
  /** `'subject1'` = issued by this company (sales); `'subject2'` = received (purchases). */
  subjectType: 'subject1' | 'subject2'
  /** Inclusive start date, `YYYY-MM-DD`; widened to the full day server-side. */
  dateFrom: string
  /** Inclusive end date, `YYYY-MM-DD`; widened to the full day server-side. */
  dateTo: string
}

/** One row of invoice metadata. Fetch the XML separately for full contents. */
export type KsefInvoiceRef = {
  ksefReferenceNumber: string
  invoiceNumber: string
  invoiceDate: string
  /** Counterparty name: the seller for purchases, the buyer for sales. */
  subjectName: string
  /** Counterparty NIP, or `''` when the metadata omitted it. */
  subjectNip: string
  grossAmount: number
}

export class KsefApiClient {
  private environment: KsefEnvironment
  private baseUrl: string
  private authTokens: KsefAuthTokens | null = null
  private sessionRef: string | null = null

  /**
   * @param environment Which KSeF deployment to talk to — `'test'`, `'demo'`
   *   or `'prod'`. Credentials are environment-specific and are not portable
   *   between them.
   */
  constructor(environment: KsefEnvironment) {
    this.environment = environment
    this.baseUrl = V2_BASE_URLS[environment]
  }

  /**
   * Authenticates using the 6-step v2 token flow. Required before any other
   * operation.
   *
   * @param nip The company's tax ID — the context the tokens are issued for.
   * @param token Raw KSeF authorization token, decrypted from storage.
   * @returns The issued tokens, so callers can persist the refresh token.
   * @throws {KsefAuthError} On challenge, submission, polling or redeem failure.
   */
  async authenticate(nip: string, token: string): Promise<KsefAuthTokens> {
    this.authTokens = await authenticateWithKsef(this.environment, nip, token)
    ksefDebug(
      'KSeF Client',
      'Auth complete. accessToken:',
      describeSecret(this.authTokens.accessToken),
      '| refreshToken:',
      describeSecret(this.authTokens.refreshToken),
      '| expiresAt:',
      this.authTokens.accessTokenExpiresAt
    )
    return this.authTokens
  }

  /**
   * Authenticates using the v2 certificate flow (XAdES-BES signature over a
   * challenge). The alternative to {@link authenticate} for companies holding
   * a qualified certificate.
   *
   * Yields the same tokens as token auth, so everything downstream is identical.
   *
   * @param nip The company's tax ID.
   * @param certificatePem Qualified certificate, PEM-encoded.
   * @param privateKeyPem Matching private key, PEM-encoded and already
   *   decrypted. RSA and EC keys are both supported.
   * @throws {KsefAuthError} On signing or authentication failure.
   */
  async authenticateWithCert(
    nip: string,
    certificatePem: string,
    privateKeyPem: string
  ): Promise<KsefAuthTokens> {
    this.authTokens = await authenticateWithCertificate(
      this.environment,
      nip,
      certificatePem,
      privateKeyPem
    )
    return this.authTokens
  }

  /**
   * Opens an online session and stores its reference on the client.
   *
   * Required only for {@link sendInvoice} — queries and downloads are
   * session-free in v2. Pair with {@link closeSession} in a `finally`.
   *
   * Requires: {@link authenticate}.
   *
   * @returns The session reference number, also retained internally.
   * @throws {KsefApiError} `AUTH_REQUIRED` if not authenticated;
   *   `SESSION_FAILED` if KSeF rejects the request or returns no reference.
   */
  async openSession(): Promise<string> {
    this.requireAuth()

    const response = await this.request('POST', '/v2/sessions/online', {})

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError(
        'SESSION_FAILED',
        `Failed to open KSeF session: ${error}`,
        response.status
      )
    }

    const data = await response.json()
    this.sessionRef = data.referenceNumber
    if (!this.sessionRef) {
      throw new KsefApiError('SESSION_FAILED', 'No referenceNumber returned from session open', 500)
    }

    return this.sessionRef
  }

  /**
   * Closes the current online session.
   *
   * A no-op when no session is open. The stored reference is cleared even if
   * the close request fails, so the client cannot go on using a session KSeF
   * may have already dropped. Safe to call in a `finally`.
   */
  async closeSession(): Promise<void> {
    if (!this.sessionRef) return

    try {
      await this.request('POST', `/v2/sessions/online/${this.sessionRef}/close`, {})
    } finally {
      this.sessionRef = null
    }
  }

  /**
   * Submits an invoice XML in the open session.
   *
   * A successful return means KSeF accepted the submission, not that the
   * invoice is accepted — poll {@link getInvoiceStatus} for the KSeF number.
   * The body is sent as `application/octet-stream`, unmodified, so it must
   * already be schema-valid FA(3) (see `./fa3-xml-builder.ts`).
   *
   * Requires: {@link authenticate} + {@link openSession}.
   *
   * @throws {KsefApiError} `AUTH_REQUIRED` / `SESSION_REQUIRED` when a step was
   *   skipped; `SEND_FAILED` when KSeF rejects the invoice — the message
   *   carries the upstream validation detail.
   */
  async sendInvoice(xml: string): Promise<KsefSendResult> {
    this.requireSession()

    const response = await this.request(
      'POST',
      `/v2/sessions/online/${this.sessionRef}/invoices`,
      xml,
      { 'Content-Type': 'application/octet-stream' }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('SEND_FAILED', `Failed to send invoice: ${error}`, response.status)
    }

    const data = await response.json()
    return {
      elementReferenceNumber: data.elementReferenceNumber,
      referenceNumber: data.referenceNumber,
      processingCode: data.processingCode,
      processingDescription: data.processingDescription,
    }
  }

  /**
   * Reads the processing status of a previously submitted invoice.
   *
   * The session reference is passed explicitly rather than taken from the
   * client, so status can be polled from a later request — typically after the
   * sending session has already closed.
   *
   * Requires: {@link authenticate} only.
   *
   * @param sessionRef Session the invoice was sent in, as persisted at send time.
   * @param invoiceRef The submission's `elementReferenceNumber`.
   * @throws {KsefApiError} `AUTH_REQUIRED` if not authenticated; `STATUS_FAILED`
   *   if KSeF rejects the query.
   */
  async getInvoiceStatus(sessionRef: string, invoiceRef: string): Promise<KsefInvoiceStatus> {
    this.requireAuth()

    const response = await this.request('GET', `/v2/sessions/${sessionRef}/invoices/${invoiceRef}`)

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError(
        'STATUS_FAILED',
        `Failed to get invoice status: ${error}`,
        response.status
      )
    }

    const data = await response.json()
    return {
      invoiceStatus: data.processingCode,
      ksefReferenceNumber: data.ksefReferenceNumber || null,
      acquisitionTimestamp: data.acquisitionTimestamp || null,
    }
  }

  /**
   * Queries invoice metadata for a date range. Session-free in v2.
   *
   * Absorbs several v2 response shapes: the subject type is capitalized and
   * dates are widened to full ISO-8601 timestamps on the way out, and on the
   * way back both the `invoices` and legacy `invoiceHeaderList` arrays are
   * accepted, as are `ksefNumber`/`ksefReferenceNumber` and the seller/buyer
   * identifier variants. Missing fields become `''` or `0` rather than
   * throwing, so one odd row cannot fail an entire import.
   *
   * Returns a single unpaginated batch — there is no cursor here, so a very
   * wide date range is bounded by whatever KSeF chooses to return. Import in
   * date slices when backfilling.
   *
   * Requires: {@link authenticate} only.
   *
   * @throws {KsefApiError} `AUTH_REQUIRED` if not authenticated; `FETCH_FAILED`
   *   if KSeF rejects the query.
   */
  async fetchInvoices(criteria: KsefQueryCriteria): Promise<KsefInvoiceRef[]> {
    this.requireAuth()

    // v2 API flat structure (no filters wrapper)
    // - subjectType must be capitalized: Subject1, Subject2
    // - dates must be ISO-8601 with timezone
    const subjectTypeMap: Record<string, string> = {
      subject1: 'Subject1',
      subject2: 'Subject2',
    }

    const queryBody = {
      subjectType: subjectTypeMap[criteria.subjectType] || criteria.subjectType,
      dateRange: {
        dateType: 'Invoicing',
        from: `${criteria.dateFrom}T00:00:00.000+00:00`,
        to: `${criteria.dateTo}T23:59:59.000+00:00`,
      },
    }

    ksefDebug(
      'KSeF Client',
      'Invoice query POST /v2/invoices/query/metadata:',
      JSON.stringify(queryBody)
    )

    const response = await this.request('POST', '/v2/invoices/query/metadata', queryBody)

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('FETCH_FAILED', `Failed to fetch invoices: ${error}`, response.status)
    }

    const data = await response.json()

    // v2 API returns 'invoices' array
    const items = data.invoices || data.invoiceHeaderList || []
    // The response body lists every counterparty name, NIP and amount in range —
    // commercial data, so it stays behind KSEF_DEBUG. The count does not.
    ksefDebug('KSeF Client', 'Invoice query response:', JSON.stringify(data))
    ksefDebug('KSeF Client', 'Found', items.length, 'invoices')

    return items.map((item: Record<string, unknown>) => {
      // v2 response format:
      // - ksefNumber (not ksefReferenceNumber)
      // - seller.nip, seller.name
      // - buyer.identifier.value, buyer.name
      const seller = item.seller as Record<string, unknown> | undefined
      const buyer = item.buyer as Record<string, unknown> | undefined
      const buyerIdentifier = buyer?.identifier as Record<string, unknown> | undefined

      return {
        ksefReferenceNumber:
          (item.ksefNumber as string) || (item.ksefReferenceNumber as string) || '',
        invoiceNumber: (item.invoiceNumber as string) || '',
        invoiceDate: (item.issueDate as string) || (item.invoicingDate as string) || '',
        subjectName: (seller?.name as string) || (buyer?.name as string) || '',
        subjectNip: (seller?.nip as string) || (buyerIdentifier?.value as string) || '',
        grossAmount: (item.grossAmount as number) || 0,
      }
    })
  }

  /**
   * Downloads an invoice's full FA(3) XML by KSeF number. Session-free in v2.
   *
   * Returns the raw document — parse with `./fa3-xml-parser.ts`. This is the
   * authoritative copy held by KSeF, so it is what should be archived.
   *
   * Requires: {@link authenticate} only.
   *
   * @throws {KsefApiError} `AUTH_REQUIRED` if not authenticated; `FETCH_FAILED`
   *   if the invoice is unknown or inaccessible to this context.
   */
  async getInvoice(ksefReferenceNumber: string): Promise<string> {
    this.requireAuth()

    const response = await this.request('GET', `/v2/invoices/ksef/${ksefReferenceNumber}`)

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('FETCH_FAILED', `Failed to get invoice: ${error}`, response.status)
    }

    return response.text()
  }

  /**
   * Lists the active permission scopes the authenticated context holds.
   *
   * Used by credential validation to show what a token or certificate can
   * actually do — a credential that authenticates but grants nothing useful is
   * worth surfacing at setup rather than at the first failed send.
   *
   * Unlike the other methods, a failed query is **not** an error: it warns and
   * returns `[]`, because permissions are advisory here and an unavailable
   * permissions endpoint should not fail an otherwise valid credential check.
   * An empty array therefore means "none granted, or could not be determined".
   *
   * Requires: {@link authenticate}.
   *
   * @param nip Context to query, normally the same NIP used to authenticate.
   * @returns Unique scope strings, capped at the first 100 grants.
   * @throws {KsefApiError} `AUTH_REQUIRED` if not authenticated.
   */
  async queryPersonalPermissions(nip: string): Promise<string[]> {
    this.requireAuth()

    const response = await this.request(
      'POST',
      '/v2/permissions/query/personal/grants?pageSize=100',
      {
        contextIdentifier: { type: 'Nip', value: nip },
        permissionState: 'Active',
      }
    )

    if (!response.ok) {
      ksefWarn('KSeF Client', 'Permissions query failed:', response.status)
      return []
    }

    const data = await response.json()
    const permissions = data.permissions || []
    return [
      ...new Set(permissions.map((p: { permissionScope: string }) => p.permissionScope)),
    ] as string[]
  }

  /**
   * The open session's reference, or `null` if none is open.
   * Persist alongside a sent invoice so its status can be polled later.
   */
  getSessionRef(): string | null {
    return this.sessionRef
  }

  /**
   * The current tokens, or `null` before authentication.
   *
   * Returns live credential material — for persisting the refresh token, not
   * for logging or returning to a client.
   */
  getAuthTokens(): KsefAuthTokens | null {
    return this.authTokens
  }

  /**
   * Issues an HTTP request against the KSeF base URL, attaching the bearer
   * token once authenticated.
   *
   * A string `body` is sent as-is (invoice XML); anything else is JSON-encoded
   * with a matching content type. Non-2xx responses are returned to the caller
   * to interpret — only transport failures are converted here, into
   * `CONNECTION_ERROR`.
   */
  private async request(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    }

    if (this.authTokens) {
      headers['Authorization'] = `Bearer ${this.authTokens.accessToken}`
    }

    const isRawBody = typeof body === 'string'
    if (body && !isRawBody) {
      headers['Content-Type'] = 'application/json'
    }

    // `headers` carries `Authorization: Bearer <accessToken>` on every
    // authenticated call — redactHeaders masks it unconditionally.
    ksefDebug(
      'KSeF Client',
      `Request: ${method} ${this.baseUrl}${path}`,
      '| headers:',
      JSON.stringify(redactHeaders(headers))
    )

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? (isRawBody ? body : JSON.stringify(body)) : undefined,
      })
      ksefDebug('KSeF Client', `Response status: ${response.status}`)
      return response
    } catch (error) {
      throw new KsefApiError(
        'CONNECTION_ERROR',
        `Cannot connect to KSeF (${this.environment}): ${error instanceof Error ? error.message : String(error)}`,
        0
      )
    }
  }

  /** Asserts {@link authenticate} has run. @throws {KsefApiError} `AUTH_REQUIRED` */
  private requireAuth(): void {
    if (!this.authTokens) {
      throw new KsefApiError(
        'AUTH_REQUIRED',
        'KSeF authentication required — call authenticate() first',
        401
      )
    }
  }

  /**
   * Asserts both authentication and an open session.
   * @throws {KsefApiError} `AUTH_REQUIRED` or `SESSION_REQUIRED`
   */
  private requireSession(): void {
    this.requireAuth()
    if (!this.sessionRef) {
      throw new KsefApiError(
        'SESSION_REQUIRED',
        'KSeF session required — call openSession() first',
        401
      )
    }
  }
}

/**
 * Error from a KSeF API operation.
 *
 * `code` is one of the stable strings documented on the methods above
 * (`AUTH_REQUIRED`, `SESSION_REQUIRED`, `SESSION_FAILED`, `SEND_FAILED`,
 * `STATUS_FAILED`, `FETCH_FAILED`, `CONNECTION_ERROR`); `statusCode` is the
 * upstream HTTP status, or `0` when the request never completed.
 *
 * Authentication failures use {@link KsefAuthError} instead.
 */
export class KsefApiError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode: number) {
    super(message)
    this.name = 'KsefApiError'
    this.code = code
    this.statusCode = statusCode
  }
}

export { KsefAuthError }
