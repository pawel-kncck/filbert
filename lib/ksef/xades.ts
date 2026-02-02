import { SignedXml } from 'xml-crypto'
import { createHash, randomUUID } from 'node:crypto'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const KSEF_AUTH_REQUEST_NS =
  'http://ksef.mf.gov.pl/schema/gtw/svc/online/auth/request/2021/10/01/0001'

/**
 * Builds the KSeF authentication InitRequest XML for certificate-based auth.
 */
export function buildAuthInitRequestXml(challenge: string, nip: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<InitRequest xmlns="${KSEF_AUTH_REQUEST_NS}">`,
    '  <Context>',
    `    <Challenge>${escapeXml(challenge)}</Challenge>`,
    '    <Identifier xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="SubjectIdentifierByCompanyType">',
    `      <Identifier>${escapeXml(nip)}</Identifier>`,
    '    </Identifier>',
    '  </Context>',
    '</InitRequest>',
  ].join('\n')
}

/**
 * Signs an XML document with XAdES-BES enveloped signature using the provided
 * certificate and private key (both PEM-encoded).
 *
 * XAdES-BES adds:
 * - SigningTime
 * - SigningCertificateV2 (SHA-256 cert digest)
 */
export function signXmlWithXades(
  xml: string,
  certificatePem: string,
  privateKeyPem: string
): string {
  const certDer = pemToDer(certificatePem)
  const certDigest = createHash('sha256').update(certDer).digest('base64')
  const certBase64 = certDer.toString('base64')

  const sigId = `xmldsig-${randomUUID()}`
  const signedPropsId = `${sigId}-signedprops`
  const signingTime = new Date().toISOString()

  // Build XAdES QualifyingProperties as a string for the Object element
  const xadesObject = buildXadesObject(sigId, signedPropsId, signingTime, certDigest)

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  })

  sig.addReference({
    xpath: '/*',
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  })

  // Add reference to the SignedProperties for XAdES compliance
  sig.addReference({
    uri: `#${signedPropsId}`,
    transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    isEmptyUri: false,
  })

  // Set the signing certificate for KeyInfo
  ;(sig as unknown as Record<string, unknown>).signingCert = certBase64
  sig.keyInfoAttributes = { Id: `${sigId}-keyinfo` }

  sig.computeSignature(xml, {
    location: { reference: '/*', action: 'append' },
    prefix: 'ds',
  })

  // Now inject the XAdES Object into the Signature element
  const signedXml = sig.getSignedXml()
  return injectXadesObject(signedXml, xadesObject)
}

function buildXadesObject(
  sigId: string,
  signedPropsId: string,
  signingTime: string,
  certDigest: string
): string {
  return [
    `<ds:Object>`,
    `  <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">`,
    `    <xades:SignedProperties Id="${signedPropsId}">`,
    `      <xades:SignedSignatureProperties>`,
    `        <xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `        <xades:SigningCertificateV2>`,
    `          <xades:Cert>`,
    `            <xades:CertDigest>`,
    `              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `              <ds:DigestValue>${certDigest}</ds:DigestValue>`,
    `            </xades:CertDigest>`,
    `          </xades:Cert>`,
    `        </xades:SigningCertificateV2>`,
    `      </xades:SignedSignatureProperties>`,
    `    </xades:SignedProperties>`,
    `  </xades:QualifyingProperties>`,
    `</ds:Object>`,
  ].join('\n')
}

/**
 * Injects the XAdES Object element into an existing Signature element.
 */
function injectXadesObject(signedXml: string, xadesObject: string): string {
  const doc = new DOMParser().parseFromString(signedXml, 'text/xml')

  // Find the ds:Signature element
  const sigElements = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')
  if (sigElements.length === 0) {
    throw new Error('No Signature element found in signed XML')
  }

  const sigElement = sigElements[0]!

  // Parse the XAdES Object fragment
  const objDoc = new DOMParser().parseFromString(
    `<root xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${xadesObject}</root>`,
    'text/xml'
  )
  const objElement = objDoc.documentElement.firstChild

  if (objElement) {
    const imported = doc.importNode(objElement, true)
    sigElement.appendChild(imported)
  }

  return new XMLSerializer().serializeToString(doc)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function pemToDer(pem: string): Buffer {
  const lines = pem.split('\n').filter((line) => !line.startsWith('-----'))
  return Buffer.from(lines.join(''), 'base64')
}
