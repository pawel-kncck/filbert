export type GusEnvironment = 'test' | 'prod'

export type GusEntityType = 'fizyczna' | 'prawna'

export type GusCompanyData = {
  nip: string
  regon: string
  name: string
  entityType: GusEntityType
  province: string
  district: string
  community: string
  city: string
  postalCode: string
  street: string
  propertyNumber: string
  apartmentNumber: string
  statusCode: string
  activityEndDate: string | null
}

export type GusFormattedResult = {
  nip: string
  regon: string
  name: string
  address: string
  isActive: boolean
  entityType: GusEntityType
}
