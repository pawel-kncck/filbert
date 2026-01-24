import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST() {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') || 'http://localhost:3000'

  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/login', origin), {
    status: 302,
  })
}
