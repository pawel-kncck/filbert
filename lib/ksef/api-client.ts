import {
  authenticateWithKsef,
  authenticateWithCertificate,
  KsefAuthError,
  type KsefAuthTokens,
} from './auth'
import { V2_BASE_URLS } from './types'
export type { KsefEnvironment, KsefAuthMethod } from './types'
import type { KsefEnvironment } from './types'

export type KsefSendResult = {
  elementReferenceNumber: string
  referenceNumber: string
  processingCode: number
  processingDescription: string
}

export type KsefInvoiceStatus = {
  invoiceStatus: number
  ksefReferenceNumber: string | null
  acquisitionTimestamp: string | null
}

export type KsefQueryCriteria = {
  subjectType: 'subject1' | 'subject2'
  dateFrom: string
  dateTo: string
}

export type KsefInvoiceRef = {
  ksefReferenceNumber: string
  invoiceNumber: string
  invoiceDate: string
  subjectName: string
  subjectNip: string
  grossAmount: number
}

export class KsefApiClient {
  private environment: KsefEnvironment
  private baseUrl: string
  private authTokens: KsefAuthTokens | null = null
  private sessionRef: string | null = null

  constructor(environment: KsefEnvironment) {
    this.environment = environment
    this.baseUrl = V2_BASE_URLS[environment]
  }

  /**
   * Authenticates with KSeF using the 6-step v2 token-based flow.
   * Required before any API operation.
   */
  async authenticate(nip: string, token: string): Promise<KsefAuthTokens> {
    this.authTokens = await authenticateWithKsef(this.environment, nip, token)
    console.log(
      '[KSeF Client] Auth complete, accessToken starts with:',
      this.authTokens.accessToken?.substring(0, 50)
    )
    console.log(
      '[KSeF Client] Auth complete, refreshToken starts with:',
      this.authTokens.refreshToken?.substring(0, 50)
    )
    console.log('[KSeF Client] Auth complete, expiresAt:', this.authTokens.accessTokenExpiresAt)
    return this.authTokens
  }

  /**
   * Authenticates with KSeF using the v2 certificate-based flow (XAdES-BES).
   * Alternative to token-based authentication using a qualified certificate.
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
   * Opens an online session. Required only for sending invoices.
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
   * Sends an invoice XML within an open session.
   * Requires: authenticate() + openSession()
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
   * Gets the status of a sent invoice within a session.
   * Requires: authenticate() + openSession()
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
   * Queries invoice metadata. Session-free in v2.
   * Requires: authenticate() only
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

    console.log('[KSeF Client] ========== INVOICE QUERY ==========')
    console.log('[KSeF Client] Endpoint: POST /v2/invoices/query/metadata')
    console.log('[KSeF Client] Request body:')
    console.log(JSON.stringify(queryBody, null, 2))

    const response = await this.request('POST', '/v2/invoices/query/metadata', queryBody)

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('FETCH_FAILED', `Failed to fetch invoices: ${error}`, response.status)
    }

    const data = await response.json()
    console.log('[KSeF Client] ========== INVOICE QUERY RESPONSE ==========')
    console.log(JSON.stringify(data, null, 2))

    // v2 API returns 'invoices' array
    const items = data.invoices || data.invoiceHeaderList || []
    console.log('[KSeF Client] Found', items.length, 'invoices')

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
   * Downloads a full invoice XML by KSeF reference number. Session-free in v2.
   * Requires: authenticate() only
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
   * Queries personal permissions for the authenticated user.
   * Returns an array of unique permission scope strings.
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
      console.warn('[KSeF Client] Permissions query failed:', response.status)
      return []
    }

    const data = await response.json()
    const permissions = data.permissions || []
    return [
      ...new Set(permissions.map((p: { permissionScope: string }) => p.permissionScope)),
    ] as string[]
  }

  getSessionRef(): string | null {
    return this.sessionRef
  }

  getAuthTokens(): KsefAuthTokens | null {
    return this.authTokens
  }

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

    console.log(`[KSeF Client] Request: ${method} ${this.baseUrl}${path}`)
    console.log('[KSeF Client] Headers:', JSON.stringify(headers, null, 2))

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? (isRawBody ? body : JSON.stringify(body)) : undefined,
      })
      console.log(`[KSeF Client] Response status: ${response.status}`)
      return response
    } catch (error) {
      throw new KsefApiError(
        'CONNECTION_ERROR',
        `Cannot connect to KSeF (${this.environment}): ${error instanceof Error ? error.message : String(error)}`,
        0
      )
    }
  }

  private requireAuth(): void {
    if (!this.authTokens) {
      throw new KsefApiError(
        'AUTH_REQUIRED',
        'KSeF authentication required — call authenticate() first',
        401
      )
    }
  }

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
