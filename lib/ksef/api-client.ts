export type KsefEnvironment = 'test' | 'demo' | 'prod'

const API_URLS: Record<KsefEnvironment, string> = {
  test: 'https://ksef-test.mf.gov.pl/api',
  demo: 'https://ksef-demo.mf.gov.pl/api',
  prod: 'https://ksef.mf.gov.pl/api',
}

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
  private sessionToken: string | null = null

  constructor(environment: KsefEnvironment) {
    this.environment = environment
    this.baseUrl = API_URLS[environment]
  }

  async initSession(nip: string, token: string): Promise<void> {
    const response = await this.request(
      'POST',
      '/online/Session/InitSigned',
      {
        Context: {
          Challenge: this.generateChallenge(),
          Identifier: {
            type: 'onip',
            identifier: nip,
          },
          DocumentType: {
            service: 'KSeF',
            formCode: {
              systemCode: 'FA (3)',
              schemaVersion: '1-0E',
              targetNamespace: 'http://crd.gov.pl/wzor/2023/06/29/12648/',
              value: 'FA',
            },
          },
        },
      },
      {
        Authorization: `Bearer ${token}`,
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('AUTH_FAILED', `KSeF authentication failed: ${error}`, response.status)
    }

    const data = await response.json()
    this.sessionToken = data.sessionToken?.token
    if (!this.sessionToken) {
      throw new KsefApiError('SESSION_FAILED', 'No session token returned from KSeF', 500)
    }
  }

  async terminateSession(): Promise<void> {
    if (!this.sessionToken) return

    try {
      await this.request('GET', '/online/Session/Terminate')
    } finally {
      this.sessionToken = null
    }
  }

  async sendInvoice(xml: string): Promise<KsefSendResult> {
    this.requireSession()

    const response = await this.request('PUT', '/online/Invoice/Send', xml, {
      'Content-Type': 'application/octet-stream',
    })

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

  async getInvoiceStatus(elementReferenceNumber: string): Promise<KsefInvoiceStatus> {
    this.requireSession()

    const response = await this.request('GET', `/online/Invoice/Status/${elementReferenceNumber}`)

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

  async fetchInvoices(criteria: KsefQueryCriteria): Promise<KsefInvoiceRef[]> {
    this.requireSession()

    const queryBody = {
      queryCriteria: {
        subjectType: criteria.subjectType,
        type: 'incremental',
        acquisitionTimestampThresholdFrom: `${criteria.dateFrom}T00:00:00`,
        acquisitionTimestampThresholdTo: `${criteria.dateTo}T23:59:59`,
      },
    }

    const response = await this.request('POST', '/online/Query/Invoice/Sync', queryBody)

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

  async getInvoice(ksefReferenceNumber: string): Promise<string> {
    this.requireSession()

    const response = await this.request('GET', `/online/Invoice/Get/${ksefReferenceNumber}`)

    if (!response.ok) {
      const error = await response.text()
      throw new KsefApiError('FETCH_FAILED', `Failed to get invoice: ${error}`, response.status)
    }

    return response.text()
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

    if (this.sessionToken) {
      headers['SessionToken'] = this.sessionToken
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

  private requireSession(): void {
    if (!this.sessionToken) {
      throw new KsefApiError('SESSION_REQUIRED', 'KSeF session not initialized', 401)
    }
  }

  private generateChallenge(): string {
    return new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 20)
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
