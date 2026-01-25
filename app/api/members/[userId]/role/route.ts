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

  const { companyId, role } = await request.json()

  if (!companyId || !role) {
    return NextResponse.json({ error: 'Company ID and role required' }, { status: 400 })
  }

  if (!['admin', 'member', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Check if current user is admin
  const isAdmin = await isUserCompanyAdmin(user.id, companyId)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent removing the last admin
  if (role !== 'admin') {
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
  }

  // Update the role
  const { error } = await supabase
    .from('user_companies')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
