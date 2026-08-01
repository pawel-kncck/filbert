/**
 * SOAP 1.2 request envelopes for the GUS REGON (BIR1) service.
 *
 * Hand-built rather than generated from the WSDL: there are four operations,
 * each with one or two scalar parameters, so a SOAP toolchain would cost more
 * than it saves.
 *
 * Values are interpolated without XML escaping. That is safe for the inputs
 * actually used — NIP and REGON are digit strings validated upstream, and the
 * report name is chosen from a fixed map — but any new parameter carrying
 * user-supplied text must be escaped before being added here.
 *
 * @module
 */

const NAMESPACE = 'http://CIS/BIR/PUBL/2014/07/IUslugaBIRzworCSS'
const DATA_NS = 'http://CIS/BIR/PUBL/2014/07/DataContract'

/**
 * `Zaloguj` — exchanges the API key for a session id.
 *
 * @remarks Every envelope in this module hardcodes the **test** host in its
 *   WS-Addressing `wsa:To` header, including in production, where the request
 *   is nonetheless POSTed to the prod endpoint chosen by `GusApiClient`. The
 *   service routes on the URL and has not objected, so this is recorded rather
 *   than changed — but it is a mismatch, not a deliberate design.
 */
export function loginEnvelope(apiKey: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="${NAMESPACE}">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzworCSS.svc</wsa:To>
    <wsa:Action>${NAMESPACE}/IUslugaBIRzworCSS/Zaloguj</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:Zaloguj>
      <ns:pKluczUzytkownika>${apiKey}</ns:pKluczUzytkownika>
    </ns:Zaloguj>
  </soap:Body>
</soap:Envelope>`
}

/** `DaneSzukajPodmioty` — finds an entity by NIP, returning REGON and type. */
export function searchByNipEnvelope(nip: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="${NAMESPACE}" xmlns:dat="${DATA_NS}">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzworCSS.svc</wsa:To>
    <wsa:Action>${NAMESPACE}/IUslugaBIRzworCSS/DaneSzukajPodmioty</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:DaneSzukajPodmioty>
      <ns:pParametryWyszukiwania>
        <dat:Nip>${nip}</dat:Nip>
      </ns:pParametryWyszukiwania>
    </ns:DaneSzukajPodmioty>
  </soap:Body>
</soap:Envelope>`
}

/**
 * `DanePobierzPelnyRaport` — fetches the detailed record for a REGON.
 *
 * @param reportName The entity-type-specific report id; see `REPORT_NAMES` in
 *   `./api-client.ts`. Legal entities and sole proprietors use different
 *   reports with entirely different field names.
 */
export function fullReportEnvelope(regon: string, reportName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="${NAMESPACE}">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzworCSS.svc</wsa:To>
    <wsa:Action>${NAMESPACE}/IUslugaBIRzworCSS/DanePobierzPelnyRaport</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:DanePobierzPelnyRaport>
      <ns:pRegon>${regon}</ns:pRegon>
      <ns:pNazwaRaportu>${reportName}</ns:pNazwaRaportu>
    </ns:DanePobierzPelnyRaport>
  </soap:Body>
</soap:Envelope>`
}

/** `Wyloguj` — releases the session. */
export function logoutEnvelope(sessionId: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="${NAMESPACE}">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzworCSS.svc</wsa:To>
    <wsa:Action>${NAMESPACE}/IUslugaBIRzworCSS/Wyloguj</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:Wyloguj>
      <ns:pIdentyfikatorSesji>${sessionId}</ns:pIdentyfikatorSesji>
    </ns:Wyloguj>
  </soap:Body>
</soap:Envelope>`
}
