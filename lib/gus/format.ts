import type { GusCompanyData, GusFormattedResult } from './types'

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
