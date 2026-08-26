'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMySpace, updateMember, updateSpace } from '@/lib/queries'
import type { Space, Member } from '@/lib/types'

// Populated after mount — same hydration guard as ClocksSection
let _tzCache: string[] | null = null
function getTimezones(): string[] {
  if (!_tzCache) _tzCache = Intl.supportedValuesOf('timeZone').sort()
  return _tzCache
}

export default function SettingsPage() {
  const [space,   setSpace]   = useState<Space | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [timezones, setTimezones] = useState<string[]>([])
  const [saved,   setSaved]   = useState('')
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setMyUserId(user?.id ?? null)
      const mine = await getMySpace()
      if (!mine) { router.replace('/onboarding'); return }
      setSpace(mine.space)
      setMembers(mine.members)
      setTimezones(getTimezones())
    })()
  }, [router])

  function flash(msg: string) {
    setSaved(msg)
    setTimeout(() => setSaved(''), 2000)
  }

  async function saveSpace(patch: Partial<Pick<Space, 'title' | 'anniversary'>>) {
    if (!space) return
    setSpace({ ...space, ...patch })
    await updateSpace(space.id, patch)
    flash('Saved')
  }

  async function saveMember(id: string, patch: Partial<Member>) {
    setMembers(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m))
    await updateMember(id, patch)
    flash('Saved')
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!space) {
    return <main style={{ background: 'var(--bg)', minHeight: '100vh' }} />
  }

  const editable = (m: Member) => m.user_id === myUserId || m.user_id === null

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="page-container" style={{ paddingTop: 32 }}>
        <div className="diary-main-header">Settings</div>
        {saved && <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>{saved}</div>}

        {/* Space */}
        <div className="settings-block">
          <div className="person-label">Space</div>
          <label className="settings-field">
            Title
            <input
              className="input-bauhaus"
              defaultValue={space.title}
              onBlur={e => e.target.value !== space.title && saveSpace({ title: e.target.value })}
            />
          </label>
          <label className="settings-field">
            Anniversary
            <input
              type="date"
              className="input-bauhaus"
              defaultValue={space.anniversary ?? ''}
              onBlur={e => (e.target.value || null) !== space.anniversary && saveSpace({ anniversary: e.target.value || null })}
            />
          </label>
          {members.some(m => m.user_id === null) && (
            <label className="settings-field">
              Partner&apos;s Google email — they land here when they sign in with it
              <input
                type="email"
                className="input-bauhaus"
                defaultValue={members.find(m => m.user_id === null)?.invited_email ?? ''}
                onBlur={e => {
                  const seat = members.find(m => m.user_id === null)
                  if (seat && (e.target.value || null) !== seat.invited_email) {
                    saveMember(seat.id, { invited_email: e.target.value.toLowerCase() || null })
                    if (e.target.value) fetch('/api/invite', { method: 'POST' }).catch(() => {})
                  }
                }}
              />
            </label>
          )}
        </div>

        {/* Members */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {members.map(m => (
            <div key={m.id} className="settings-block" style={{ '--pc': m.color } as React.CSSProperties}>
              <div className="person-label label-person">
                {m.display_name}{m.user_id === null ? ' (not joined yet)' : ''}
              </div>
              <fieldset disabled={!editable(m)} style={{ border: 'none', padding: 0, margin: 0 }}>
                <label className="settings-field">
                  Name
                  <input
                    className="input-bauhaus"
                    defaultValue={m.display_name}
                    onBlur={e => e.target.value.trim() && e.target.value !== m.display_name && saveMember(m.id, { display_name: e.target.value.trim() })}
                  />
                </label>
                <label className="settings-field">
                  Color
                  <input
                    type="color"
                    className="input-bauhaus"
                    style={{ height: 44, padding: 4 }}
                    defaultValue={m.color}
                    onBlur={e => e.target.value !== m.color && saveMember(m.id, { color: e.target.value })}
                  />
                </label>
                <label className="settings-field">
                  Emoji (shown on map & calendar)
                  <input
                    className="input-bauhaus"
                    defaultValue={m.emoji}
                    maxLength={4}
                    onBlur={e => e.target.value.trim() && e.target.value !== m.emoji && saveMember(m.id, { emoji: e.target.value.trim() })}
                  />
                </label>
                <label className="settings-field">
                  Timezone
                  <select
                    className="tz-select"
                    value={m.timezone}
                    onChange={e => saveMember(m.id, { timezone: e.target.value })}
                  >
                    {(timezones.length ? timezones : [m.timezone]).map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  Notification email
                  <input
                    type="email"
                    className="input-bauhaus"
                    defaultValue={m.notify_email ?? ''}
                    onBlur={e => (e.target.value || null) !== m.notify_email && saveMember(m.id, { notify_email: e.target.value || null })}
                  />
                </label>
              </fieldset>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '24px 0 48px' }}>
          <a href="/" className="btn-bauhaus" style={{ textAlign: 'center', textDecoration: 'none' }}>← Back</a>
          <button className="btn-bauhaus" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </main>
  )
}
