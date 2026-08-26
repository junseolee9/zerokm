'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMySpace, updateMember, updateSpace, deleteMyAccount } from '@/lib/queries'
import { DateField } from '@/components/DateField'
import { TimezoneField } from '@/components/TimezoneField'
import type { Space, Member } from '@/lib/types'

export default function SettingsPage() {
  const [space,   setSpace]   = useState<Space | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [saved,   setSaved]   = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
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

  async function handleDeleteAccount() {
    const me = members.find(m => m.user_id === myUserId)
    if (!me) return
    setDeleting(true)
    setDeleteErr('')
    try {
      await deleteMyAccount(me.id)
      await createClient().auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (e: any) {
      setDeleting(false)
      setDeleteErr(String(e?.message ?? e))
    }
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
            When did you start dating?
            <DateField
              name="anniversary"
              label="When did you start dating? (optional)"
              defaultValue={space.anniversary ?? ''}
              onChange={v => saveSpace({ anniversary: v || null })}
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
                  <TimezoneField
                    value={m.timezone}
                    onCommit={tz => saveMember(m.id, { timezone: tz })}
                  />
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '24px 0' }}>
          <a href="/" className="btn-bauhaus" style={{ textAlign: 'center', textDecoration: 'none' }}>← Back</a>
          <button className="btn-bauhaus" onClick={signOut}>Sign out</button>
        </div>

        {/* Danger zone */}
        <div className="settings-block" style={{ borderColor: 'var(--red)', boxShadow: '6px 6px 0 var(--red)', marginBottom: 48 }}>
          <div className="person-label" style={{ color: 'var(--red)' }}>Danger zone</div>
          {!confirmDelete ? (
            <button
              className="btn-bauhaus"
              style={{ borderColor: 'var(--red)', color: 'var(--red)', marginTop: 14 }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete my account
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 14, lineHeight: 1.6 }}>
                This deletes your Google sign-in from zerokm and everything you
                wrote in the diary. If your partner is still here, they keep
                the space and can invite someone new into your seat. If they
                never joined either, the whole space goes with it. This
                cannot be undone.
              </div>
              {deleteErr && (
                <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 12, marginTop: 8 }}>{deleteErr}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <button className="btn-bauhaus" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </button>
                <button
                  className="btn-bauhaus-primary"
                  style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? '...' : 'Yes, delete everything'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
