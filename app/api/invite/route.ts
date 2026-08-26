import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInvitation } from '@/lib/email'

// Emails the invitation to the partner seat's invited_email. Everything is
// read from the caller's own space under RLS — no request body to trust.
export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: members } = await supabase.from('members').select('*')
    const me   = members?.find(m => m.user_id === user.id)
    const seat = members?.find(m => m.user_id === null)
    if (!me || !seat?.invited_email) {
      return NextResponse.json({ ok: true, sent: false })
    }

    const { data: space } = await supabase
      .from('spaces').select('title').eq('id', me.space_id).single()

    await sendInvitation(me.display_name, seat.invited_email, space?.title ?? 'zerokm')
    return NextResponse.json({ ok: true, sent: true })
  } catch (e) {
    console.error('[invite]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
