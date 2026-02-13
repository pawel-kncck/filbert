import { ExclusiveCanonicalization, C14nCanonicalization } from 'xml-crypto'
import { createHash, createPrivateKey, createSign, randomUUID } from 'node:crypto'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const KSEF_AUTH_TOKEN_NS = 'http://ksef.mf.gov.pl/auth/token/2.0'
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#'
const C14N_URI = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const EXC_C14N_URI = 'http://www.w3.org/2001/10/xml-exc-c14n#'
const ENVELOPED_SIG_URI = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const SHA256_URI = 'http://www.w3.org/2001/04/xmlenc#sha256'

/**
 * Builds the KSeF AuthTokenRequest XML for certificate-based auth
 * submitted to /v2/auth/xades-signature.
 */
export function buildAuthInitRequestXml(challenge: string, nip: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<AuthTokenRequest xmlns="${KSEF_AUTH_TOKEN_NS}">`,
    `  <Challenge>${escapeXml(challenge)}</Challenge>`,
    '  <ContextIdentifier>',
    `    <Nip>${escapeXml(nip)}</Nip>`,
    '  </ContextIdentifier>',
    '  <SubjectIdentifierType>certificateSubject</SubjectIdentifierType>',
    '</AuthTokenRequest>',
  ].join('\n')
}

/**
 * Signs an XML document with XAdES-BES enveloped signature using the provided
 * certificate and private key (both PEM-encoded). Supports both RSA and EC keys.
 *
 * Uses inclusive Canonical XML (c14n) for SignedInfo canonicalization to match
 * KSeF's .NET-based signature verification. The inherited default namespace from
 * the parent document is included in the canonical form so that the signed bytes
 * match what the server computes during verification.
 */
export function signXmlWithXades(
  xml: string,
  certificatePem: string,
  privateKeyPem: string
): string {
  // Detect key type for signature algorithm
  const keyObject = createPrivateKey({ key: privateKeyPem })
  const isEc = keyObject.asymmetricKeyType === 'ec'
  const sigAlgUri = isEc
    ? 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
    : 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'

  // Setup identifiers and certificate info
  const certDer = pemToDer(certificatePem)
  const certDigest = createHash('sha256').update(certDer).digest('base64')
  const certBase64 = certDer.toString('base64')
  const sigId = `xmldsig-${randomUUID()}`
  const signedPropsId = `${sigId}-signedprops`
  const keyInfoId = `${sigId}-keyinfo`
  const signingTime = new Date().toISOString()

  const incC14n = new C14nCanonicalization()
  const excC14n = new ExclusiveCanonicalization()

  // Step 1: Compute digest of the root element.
  // The enveloped-signature transform removes <ds:Signature> children,
  // but since we haven't added one yet the canonical form is just the root element.
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const canonRoot = incC14n.process(doc.documentElement, {}).toString()
  const rootDigest = createHash('sha256').update(canonRoot).digest('base64')

  // Extract the root element's default namespace — needed for inclusive c14n of
  // the embedded SignedInfo, where this namespace is inherited from the ancestor.
  const rootDefaultNs = doc.documentElement.namespaceURI || ''

  // Step 2: Build SignedProperties and compute its digest.
  // The reference transform for SignedProperties uses exclusive c14n.
  const signedPropsXml =
    `<xades:SignedProperties xmlns:xades="${XADES_NS}" xmlns:ds="${DSIG_NS}" Id="${signedPropsId}">` +
    `<xades:SignedSignatureProperties>` +
    `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
    `<xades:SigningCertificateV2>` +
    `<xades:Cert>` +
    `<xades:CertDigest>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/>` +
    `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
    `</xades:CertDigest>` +
    `</xades:Cert>` +
    `</xades:SigningCertificateV2>` +
    `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`

  const signedPropsDoc = new DOMParser().parseFromString(signedPropsXml, 'text/xml')
  const canonSignedProps = excC14n.process(signedPropsDoc.documentElement, {}).toString()
  const signedPropsDigest = createHash('sha256').update(canonSignedProps).digest('base64')

  // Step 3: Build SignedInfo (with both references).
  // Uses inclusive c14n as CanonicalizationMethod for KSeF compatibility.
  // Only declare xmlns:ds here — the inherited default namespace from the parent
  // document will be injected into the canonical form via string replacement below.
  const signedInfoXml =
    `<ds:SignedInfo xmlns:ds="${DSIG_NS}">` +
    `<ds:CanonicalizationMethod Algorithm="${C14N_URI}"/>` +
    `<ds:SignatureMethod Algorithm="${sigAlgUri}"/>` +
    `<ds:Reference URI="">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="${ENVELOPED_SIG_URI}"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/>` +
    `<ds:DigestValue>${rootDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${signedPropsId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="${EXC_C14N_URI}"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256_URI}"/>` +
    `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`

  // Step 4: Canonicalize SignedInfo for signing.
  // Use inclusive c14n, then inject the inherited default namespace from the parent
  // document via string replacement. This is necessary because xml-crypto's c14n
  // doesn't propagate ancestor namespace context when processing a standalone subtree.
  // KSeF's .NET verifier computes the canonical form with the inherited namespace
  // included, so the signed bytes must match.
  const signedInfoDoc = new DOMParser().parseFromString(signedInfoXml, 'text/xml')
  let canonSignedInfo = incC14n.process(signedInfoDoc.documentElement, {}).toString()
  if (rootDefaultNs) {
    canonSignedInfo = canonSignedInfo.replace(
      `<ds:SignedInfo xmlns:ds="${DSIG_NS}">`,
      `<ds:SignedInfo xmlns="${rootDefaultNs}" xmlns:ds="${DSIG_NS}">`
    )
  }

  // Step 5: Compute signature value.
  // For ECDSA, XML DSig requires IEEE P1363 format (raw r||s), not DER.
  const signer = createSign('SHA256')
  signer.update(canonSignedInfo)
  const signatureValue = isEc
    ? signer.sign({ key: privateKeyPem, dsaEncoding: 'ieee-p1363' }, 'base64')
    : signer.sign(privateKeyPem, 'base64')

  // Step 6: Assemble the complete ds:Signature element.
  // Strip xmlns:ds from SignedInfo since it's inherited from the parent ds:Signature.
  const embeddedSignedInfoXml = signedInfoXml.replace(` xmlns:ds="${DSIG_NS}"`, '')

  const signatureElementXml =
    `<ds:Signature xmlns:ds="${DSIG_NS}" Id="${sigId}">` +
    embeddedSignedInfoXml +
    `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
    `<ds:KeyInfo Id="${keyInfoId}">` +
    `<ds:X509Data>` +
    `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
    `</ds:X509Data>` +
    `</ds:KeyInfo>` +
    `<ds:Object>` +
    `<xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${sigId}">` +
    // SignedProperties (strip redundant namespace declarations)
    signedPropsXml.replace(` xmlns:xades="${XADES_NS}"`, '').replace(` xmlns:ds="${DSIG_NS}"`, '') +
    `</xades:QualifyingProperties>` +
    `</ds:Object>` +
    `</ds:Signature>`

  // Step 7: Inject into the original document.
  const sigDoc = new DOMParser().parseFromString(signatureElementXml, 'text/xml')
  const importedSig = doc.importNode(sigDoc.documentElement, true)
  doc.documentElement.appendChild(importedSig)

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
