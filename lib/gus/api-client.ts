/**
 * SOAP client for the GUS REGON (BIR1) registry — the Polish statistical
 * office's company lookup, used to prefill company details from a NIP.
 *
 * The service is SOAP 1.2 with two quirks this client absorbs:
 *
 * - **Session id travels in a header, not a cookie.** `login()` exchanges the
 *   API key for a session id which is then sent as the `sid` header on every
 *   subsequent request. Calls before `login()` throw rather than silently
 *   returning nothing.
 * - **Results are XML nested inside XML.** The SOAP body's result element
 *   contains an escaped/CDATA XML document, so responses are parsed twice.
 *
 * Field names differ entirely between the two entity types — `praw_*` for
 * registered legal entities and `fiz_*` for sole proprietors — which is why
 * there are two mapping functions rather than one.
 *
 * Prefer the {@link import('./index').lookupNip} facade over using this class
 * directly: it sequences login → search → report → logout and adds caching.
 *
 * @see https://api.stat.gov.pl/Home/RegonApi
 */
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

  /**
   * @param environment `'test'` accepts the published test key
   *   (`abcde12345abcde12345`) and returns fixture data; `'prod'` requires a
   *   registered key and hits the live registry.
   */
  constructor(environment: GusEnvironment) {
    this.baseUrl = API_URLS[environment]
  }

  /**
   * Exchanges the API key for a session id, which is then attached to every
   * later request. Must be called before {@link searchByNip} or
   * {@link getFullReport}.
   *
   * @param apiKey GUS user key, from `GUS_API_KEY`.
   * @throws {GusApiError} `AUTH_FAILED` when the service returns no session id,
   *   which is how it signals a rejected key.
   */
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

  /**
   * Ends the session and clears the stored id.
   *
   * A no-op when not logged in. The id is cleared even if the request fails, so
   * the client cannot keep reusing a session the server may have dropped.
   * Sessions are a limited resource on the GUS side — call this in a `finally`.
   */
  async logout(): Promise<void> {
    if (!this.sessionId) return

    try {
      const xml = logoutEnvelope(this.sessionId)
      await this.soapRequest(xml)
    } finally {
      this.sessionId = null
    }
  }

  /**
   * Resolves a NIP to the REGON and entity type needed by
   * {@link getFullReport}. Step one of the two-call lookup.
   *
   * Only the first match is used — a NIP identifies one entity, so multiple
   * rows would indicate registry duplicates rather than a real choice.
   *
   * @param nip Polish tax ID, 10 digits, no separators.
   * @returns The identifiers, or `null` when the NIP is not in the registry or
   *   the response carried no data element.
   * @throws {GusApiError} `SESSION_FAILED` if called before {@link login}.
   */
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

  /**
   * Fetches the full registry record — name and address — for a REGON. Step two
   * of the two-call lookup.
   *
   * The report to request and the field names to read both depend on
   * `entityType`, so passing the value from {@link searchByNip} unchanged
   * matters: the wrong type yields a response whose fields all map to empty
   * strings rather than an error.
   *
   * @param regon REGON identifier from {@link searchByNip}.
   * @param entityType `'prawna'` (legal entity) or `'fizyczna'` (sole proprietor).
   * @returns The mapped record, or `null` when the report carried no data.
   * @throws {GusApiError} `SESSION_FAILED` if called before {@link login}.
   */
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

  /** Maps a `praw_*` legal-entity report to the shared shape. */
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

  /**
   * Maps a `fiz_*` sole-proprietor report to the shared shape.
   * `statusCode` is left empty — the legal-form symbol has no `fiz_*` analogue.
   */
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

  /**
   * Coerces a parsed XML value to a trimmed string, mapping absent fields to
   * `''`. fast-xml-parser infers types, so a postal code or building number can
   * arrive as a number.
   */
  private str(value: unknown): string {
    if (value == null) return ''
    return String(value).trim()
  }

  /** Parses XML, converting parser failures into a `PARSE_ERROR` (502). */
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

  /**
   * Walks `Envelope > Body > {responseName} > {resultName}`, returning
   * `undefined` if any level is missing. Namespace prefixes are already
   * stripped by the parser's `removeNSPrefix`.
   */
  private extractBody(parsed: XmlNode, responseName: string, resultName: string): unknown {
    const envelope = parsed['Envelope'] as XmlNode | undefined
    const body = envelope?.['Body'] as XmlNode | undefined
    const response = body?.[responseName] as XmlNode | undefined
    return response?.[resultName]
  }

  /**
   * POSTs a SOAP envelope, attaching the `sid` session header once logged in.
   *
   * Distinguishes an unreachable service (`CONNECTION_ERROR`, 503) from one
   * that answered with an HTTP error (`API_ERROR`, 502); an already-typed
   * `GusApiError` passes through unchanged rather than being re-wrapped.
   */
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
