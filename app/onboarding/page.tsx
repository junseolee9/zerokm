'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMySpace, updateMember } from '@/lib/queries'
import { DateField } from '@/components/DateField'
import { TimezoneField } from '@/components/TimezoneField'
import { isValidTimezone } from '@/lib/timezones'

type Mode = 'checking' | 'create' | 'join'

// app/page.tsx tries claim_invite() before ever sending someone here, but
// this page is reachable directly too (a stale link, a refresh after an
// earlier failed match) — so it re-checks membership itself rather than
// trusting that landing here means "definitely no space yet". A successful
// claim still needs a name and timezone from the person who just joined —
// claim_invite() only wires up the account, it doesn't know either of those.
export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>('checking')
  const [joinMemberId, setJoinMemberId] = useState<string | null>(null)
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      if (await getMySpace()) { router.replace('/'); return }

      const supabase = createClient()
      const { data: claimedSpaceId } = await supabase.rpc('claim_invite')
      if (claimedSpaceId) {
        const { data: { user } } = await supabase.auth.getUser()
        const mine = await getMySpace()
        const me = mine?.members.find(m => m.user_id === user?.id)
        if (me) {
          setJoinMemberId(me.id)
          setTz(isValidTimezone(me.timezone) ? me.timezone : tz)
          setMode('join')
          return
        }
      }
      setMode('create')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget.elements
    const supabase = createClient()

    const { error } = await supabase.rpc('create_space', {
      p_title: (form.namedItem('title') as HTMLInputElement).value,
      p_anniversary: (form.namedItem('anniversary') as HTMLInputElement).value || null,
      p_display_name: (form.namedItem('name') as HTMLInputElement).value,
      p_timezone: tz,
      p_partner_email: (form.namedItem('partner') as HTMLInputElement).value || null,
      p_emoji: (form.namedItem('emoji') as HTMLInputElement).value.trim() || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Best-effort invitation email; matching works even if it never sends.
    fetch('/api/invite', { method: 'POST' }).catch(() => {})
    router.push('/')
    router.refresh()
  }

  async function handleJoinSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget.elements
    const name = (form.namedItem('name') as HTMLInputElement).value
    const emoji = (form.namedItem('emoji') as HTMLInputElement).value.trim()

    try {
      await updateMember(joinMemberId!, {
        display_name: name,
        timezone: tz,
        ...(emoji ? { emoji } : {}),
      })
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(String(err?.message ?? err))
      setLoading(false)
    }
  }

  if (mode === 'checking') {
    return <main style={{ background: 'var(--bg)', minHeight: '100vh' }} />
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="auth-wrap">
        <div className="auth-title">zerokm</div>

        {mode === 'join' ? (
          <form onSubmit={handleJoinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: 1, textAlign: 'left' }}>
              You&apos;ve been invited! Just need your name and timezone.
            </div>
            <input name="name" className="input-bauhaus" placeholder="Your name" required autoFocus />
            <input name="emoji" className="input-bauhaus" placeholder="Your emoji (optional, shown on the map)" maxLength={4} />
            <TimezoneField value={tz} onCommit={setTz} />
            {error && (
              <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn-bauhaus-primary" disabled={loading}>
              {loading ? '...' : 'Join'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input name="name" className="input-bauhaus" placeholder="Your name" required autoFocus />
            <input name="emoji" className="input-bauhaus" placeholder="Your emoji (optional, shown on the map)" maxLength={4} />
            <input name="title" className="input-bauhaus" placeholder="Space title (e.g. Our Distance)" />
            <DateField name="anniversary" label="When did you start dating? (optional)" />
            <TimezoneField value={tz} onCommit={setTz} />
            <input
              name="partner"
              type="email"
              className="input-bauhaus"
              placeholder="Partner's Google email (optional)"
            />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: 1, textAlign: 'left' }}>
              When your partner signs in with that Google account, they land in
              this space automatically. You can set or change it later in Settings.
            </div>
            {error && (
              <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn-bauhaus-primary" disabled={loading}>
              {loading ? '...' : 'Create our space'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
