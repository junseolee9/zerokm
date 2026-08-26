import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPhotoNotification } from '@/lib/email'

// Tells the partner a photo was uploaded. Runs under the caller's own session:
// RLS only lets it see members of the caller's space, so there is nothing to
// spoof — memberId is just "which of our two seats uploaded".
export async function POST(req: NextRequest) {
  try {
    const { date, memberId } = await req.json()
    if (!date || !memberId) return NextResponse.json({ ok: false }, { status: 400 })

    const supabase = createClient()
    const { data: members } = await supabase.from('members').select('*')
    if (!members || members.length === 0) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const uploader = members.find(m => m.id === memberId)
    const partner  = members.find(m => m.id !== memberId)
    if (!uploader || !partner?.notify_email) {
      return NextResponse.json({ ok: true, sent: false })
    }

    await sendPhotoNotification(uploader.display_name, partner.notify_email, date)
    return NextResponse.json({ ok: true, sent: true })
  } catch (e) {
    console.error('[notify]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
