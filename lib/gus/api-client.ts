import { XMLParser } from 'fast-xml-parser'
import type { GusEnvironment, GusEntityType, GusCompanyData } from './types'
import { GusApiError } from './errors'
import {
  loginEnvelope,
  searchByNipEnvelope,
  fullReportEnvelope,
  logoutEnvelope,
} from './soap-templates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = Record<string, any>

const API_URLS: Record<GusEnvironment, string> = {
  test: 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzworCSS.svc',
  prod: 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzworCSS.svc',
}

const REPORT_NAMES: Record<GusEntityType, string> = {
  fizyczna: 'BIR11OsFizycznaDzworCSS',
  prawna: 'BIR11OsPrawna',
}

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
})

export class GusApiClient {
  private baseUrl: string
  private sessionId: string | null = null

  constructor(environment: GusEnvironment) {
    this.baseUrl = API_URLS[environment]
  }

  async login(apiKey: string): Promise<void> {
    const xml = loginEnvelope(apiKey)
    const responseXml = await this.soapRequest(xml)

    const parsed = this.parseXml(responseXml)
    const result = this.extractBody(parsed, 'ZalogujResponse', 'ZalogujResult')

    if (!result || typeof result !== 'string') {
      throw new GusApiError('AUTH_FAILED', 'GUS login failed: no session ID returned', 503)
    }

    this.sessionId = result
  }

  async logout(): Promise<void> {
    if (!this.sessionId) return

    try {
      const xml = logoutEnvelope(this.sessionId)
      await this.soapRequest(xml)
    } finally {
      this.sessionId = null
    }
  }

  async searchByNip(
    nip: string
  ): Promise<{ regon: string; entityType: GusEntityType; name: string } | null> {
    if (!this.sessionId) {
      throw new GusApiError('SESSION_FAILED', 'GUS session not initialized', 503)
    }

    const xml = searchByNipEnvelope(nip)
    const responseXml = await this.soapRequest(xml)

    const parsed = this.parseXml(responseXml)
    const cdataResult = this.extractBody(
      parsed,
      'DaneSzukajPodmiotyResponse',
      'DaneSzukajPodmiotyResult'
    )

    if (!cdataResult || typeof cdataResult !== 'string') {
      return null
    }

    const innerParsed = this.parseXml(cdataResult)
    const dane = innerParsed?.root?.dane ?? innerParsed?.dane

    if (!dane) {
      return null
    }

    const entry = Array.isArray(dane) ? dane[0] : dane
    const regon = entry?.Regon?.toString()?.trim()
    const typ = entry?.Typ?.toString()?.trim()
    const name = entry?.Nazwa?.toString()?.trim()

    if (!regon) {
      return null
    }

    const entityType: GusEntityType = typ === 'P' ? 'prawna' : 'fizyczna'

    return { regon, entityType, name: name || '' }
  }

  async getFullReport(regon: string, entityType: GusEntityType): Promise<GusCompanyData | null> {
    if (!this.sessionId) {
      throw new GusApiError('SESSION_FAILED', 'GUS session not initialized', 503)
    }

    const reportName = REPORT_NAMES[entityType]
    const xml = fullReportEnvelope(regon, reportName)
    const responseXml = await this.soapRequest(xml)

    const parsed = this.parseXml(responseXml)
    const cdataResult = this.extractBody(
      parsed,
      'DanePobierzPelnyRaportResponse',
      'DanePobierzPelnyRaportResult'
    )

    if (!cdataResult || typeof cdataResult !== 'string') {
      return null
    }

    const innerParsed = this.parseXml(cdataResult)
    const dane = innerParsed?.root?.dane ?? innerParsed?.dane

    if (!dane) {
      return null
    }

    const entry = Array.isArray(dane) ? dane[0] : dane

    if (entityType === 'prawna') {
      return this.mapLegalEntity(entry, regon)
    }

    return this.mapSoleProprietor(entry, regon)
  }

  private mapLegalEntity(data: XmlNode, regon: string): GusCompanyData {
    return {
      nip: this.str(data['praw_nip']),
      regon,
      name: this.str(data['praw_nazwa']),
      entityType: 'prawna',
      province: this.str(data['praw_adSiedzWojewodztwo_Nazwa']),
      district: this.str(data['praw_adSiedzPowiat_Nazwa']),
      community: this.str(data['praw_adSiedzGmina_Nazwa']),
      city: this.str(data['praw_adSiedzMiejscowosc_Nazwa']),
      postalCode: this.str(data['praw_adSiedzKodPocztowy']),
      street: this.str(data['praw_adSiedzUlica_Nazwa']),
      propertyNumber: this.str(data['praw_adSiedzNumerNieruchomosci']),
      apartmentNumber: this.str(data['praw_adSiedzNumerLokalu']),
      statusCode: this.str(data['praw_podstawowaFormaPrawna_Symbol']),
      activityEndDate: this.str(data['praw_dataZakonczeniaDzialalnosci']) || null,
    }
  }

  private mapSoleProprietor(data: XmlNode, regon: string): GusCompanyData {
    return {
      nip: this.str(data['fiz_nip']),
      regon,
      name: this.str(data['fiz_nazwa']),
      entityType: 'fizyczna',
      province: this.str(data['fiz_adSiedzWojewodztwo_Nazwa']),
      district: this.str(data['fiz_adSiedzPowiat_Nazwa']),
      community: this.str(data['fiz_adSiedzGmina_Nazwa']),
      city: this.str(data['fiz_adSiedzMiejscowosc_Nazwa']),
      postalCode: this.str(data['fiz_adSiedzKodPocztowy']),
      street: this.str(data['fiz_adSiedzUlica_Nazwa']),
      propertyNumber: this.str(data['fiz_adSiedzNumerNieruchomosci']),
      apartmentNumber: this.str(data['fiz_adSiedzNumerLokalu']),
      statusCode: '',
      activityEndDate: this.str(data['fiz_dataZakonczeniaDzialalnosci']) || null,
    }
  }

  private str(value: unknown): string {
    if (value == null) return ''
    return String(value).trim()
  }

  private parseXml(xml: string): XmlNode {
    try {
      return parser.parse(xml)
    } catch (error) {
      throw new GusApiError(
        'PARSE_ERROR',
        `Failed to parse GUS XML response: ${error instanceof Error ? error.message : String(error)}`,
        502
      )
    }
  }

  private extractBody(parsed: XmlNode, responseName: string, resultName: string): unknown {
    const envelope = parsed['Envelope'] as XmlNode | undefined
    const body = envelope?.['Body'] as XmlNode | undefined
    const response = body?.[responseName] as XmlNode | undefined
    return response?.[resultName]
  }

  private async soapRequest(xml: string): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/soap+xml; charset=utf-8',
    }

    if (this.sessionId) {
      headers['sid'] = this.sessionId
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: xml,
      })

      if (!response.ok) {
        throw new GusApiError(
          'API_ERROR',
          `GUS API returned HTTP ${response.status}: ${response.statusText}`,
          502
        )
      }

      return await response.text()
    } catch (error) {
      if (error instanceof GusApiError) throw error
      throw new GusApiError(
        'CONNECTION_ERROR',
        `Cannot connect to GUS REGON API: ${error instanceof Error ? error.message : String(error)}`,
        503
      )
    }
  }
}
