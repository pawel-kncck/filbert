import { ContactsSettingsPage } from '@/components/contacts/contacts-settings-page'

type Props = {
  searchParams: Promise<{ company?: string; page?: string; search?: string }>
}

export default function CustomersSettingsPage({ searchParams }: Props) {
  return <ContactsSettingsPage entity="customer" searchParams={searchParams} />
}
