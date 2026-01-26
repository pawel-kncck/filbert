import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing-page'

export default async function EnglishHome() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect authenticated users to companies
  if (user) {
    redirect('/companies')
  }

  return <LandingPage />
}
