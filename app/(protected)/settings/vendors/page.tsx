import { ContactsSettingsPage } from '@/components/contacts/contacts-settings-page'

type Props = {
  searchParams: Promise<{ company?: string; page?: string; search?: string }>
}

export default function VendorsSettingsPage({ searchParams }: Props) {
  return <ContactsSettingsPage entity="vendor" searchParams={searchParams} />
}
