import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClocksSection } from '@/components/ClocksSection'
import { DiarySection } from '@/components/DiarySection'
import type { Space, Member } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS narrows both tables to my space. No membership row: first see whether
  // a partner seat was reserved for this Google email; otherwise onboarding.
  let { data: memberRows } = await supabase.from('members').select('*').order('slot')
  if (!memberRows || memberRows.length === 0) {
    const { data: claimed } = await supabase.rpc('claim_invite')
    if (!claimed) redirect('/onboarding')
    ;({ data: memberRows } = await supabase.from('members').select('*').order('slot'))
    if (!memberRows || memberRows.length === 0) redirect('/onboarding')
  }
  const members = memberRows as Member[]

  const { data: spaceRow } = await supabase
    .from('spaces').select('*').eq('id', members[0].space_id).single()
  const space = spaceRow as Space

  const daysSince = space.anniversary
    ? Math.floor((Date.now() - new Date(space.anniversary).getTime()) / 86400000) + 1
    : null

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-geo-circle" />
        <div className="hero-geo-sq" />
        <div className="hero-geo-tri" />
        <div className="hero-title">{space.title}</div>
        <div className="hero-sub">
          {members.map(m => m.display_name).join('  ·  ')}
        </div>
        {daysSince !== null && (
          <div className="dday-badge">
            Together &nbsp;<span className="dday-num">{daysSince}</span>&nbsp; Days
          </div>
        )}
        <a href="/settings" className="settings-link">Settings</a>
      </section>
      <hr className="bauhaus-rule" />

      {/* ── Clocks + Map ── */}
      <div className="page-container">
        <ClocksSection members={members} myUserId={user.id} />

        {/* ── Diary ── */}
        <Suspense fallback={<div style={{ height: 400 }} />}>
          <DiarySection space={space} members={members} />
        </Suspense>
      </div>
    </main>
  )
}
