/**
 * Flattens a raw GUS registry record into the shape the company forms consume.
 *
 * @module
 */
import type { GusCompanyData, GusFormattedResult } from './types'

/**
 * Composes the registry's separate address columns into one display string and
 * derives the entity's active flag.
 *
 * Address assembly follows Polish convention — `Street 12/3, 00-001 Warszawa` —
 * and omits each part that the registry left blank, so a record with no street
 * or no postal code still produces a sensible line rather than stray
 * separators. Registered entities frequently lack a street (rural addresses
 * carry only a building number), which is why the number stands alone in that
 * case.
 *
 * `isActive` is the absence of an activity end date: GUS records closure by
 * setting `activityEndDate`, not by a status flag.
 */
export function formatGusResult(data: GusCompanyData): GusFormattedResult {
  const addressParts: string[] = []

  if (data.street) {
    let streetLine = data.street
    if (data.propertyNumber) {
      streetLine += ` ${data.propertyNumber}`
    }
    if (data.apartmentNumber) {
      streetLine += `/${data.apartmentNumber}`
    }
    addressParts.push(streetLine)
  } else if (data.propertyNumber) {
    let numberLine = data.propertyNumber
    if (data.apartmentNumber) {
      numberLine += `/${data.apartmentNumber}`
    }
    addressParts.push(numberLine)
  }

  if (data.postalCode && data.city) {
    addressParts.push(`${data.postalCode} ${data.city}`)
  } else if (data.city) {
    addressParts.push(data.city)
  }

  const isActive = !data.activityEndDate

  return {
    nip: data.nip,
    regon: data.regon,
    name: data.name,
    address: addressParts.join(', '),
    isActive,
    entityType: data.entityType,
  }
}
