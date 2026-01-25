import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isUserCompanyAdmin } from '@/lib/data/members'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { companyId } = await request.json()

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
  }

  // Check if current user is admin
  const isAdmin = await isUserCompanyAdmin(user.id, companyId)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent self-removal if last admin
  const { data: admins } = await supabase
    .from('user_companies')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('role', 'admin')
    .eq('status', 'active')

  if (admins && admins.length === 1 && admins[0].user_id === userId) {
    return NextResponse.json(
      { error: 'Nie można usunąć ostatniego administratora' },
      { status: 400 }
    )
  }

  // Remove the member
  const { error } = await supabase
    .from('user_companies')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
