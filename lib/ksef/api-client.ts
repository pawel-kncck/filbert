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

    const queryBody = {
      queryCriteria: {
        subjectType: criteria.subjectType,
        type: 'incremental',
        acquisitionTimestampThresholdFrom: `${criteria.dateFrom}T00:00:00`,
        acquisitionTimestampThresholdTo: `${criteria.dateTo}T23:59:59`,
      },
    }

    const response = await this.request('POST', '/v2/invoices/query/metadata', queryBody)

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('FETCH_FAILED', `Failed to fetch invoices: ${error}`, response.status)
    }

    const data = await response.json()
    const items = data.invoiceHeaderList || []

    return items.map((item: Record<string, unknown>) => ({
      ksefReferenceNumber: item.ksefReferenceNumber as string,
      invoiceNumber: (item.invoiceReferenceNumber as string) || '',
      invoiceDate: (item.invoicingDate as string) || '',
      subjectName:
        ((item.subjectBy as Record<string, unknown>)?.issuedByName as string) ||
        ((item.subjectTo as Record<string, unknown>)?.issuedToName as string) ||
        '',
      subjectNip:
        ((item.subjectBy as Record<string, unknown>)?.issuedByIdentifier as string) ||
        ((item.subjectTo as Record<string, unknown>)?.issuedToIdentifier as string) ||
        '',
      grossAmount: (item.invoiceGrossValue as number) || 0,
    }))
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

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? (isRawBody ? body : JSON.stringify(body)) : undefined,
      })
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
