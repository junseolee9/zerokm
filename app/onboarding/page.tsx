'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMySpace } from '@/lib/queries'
import { DateField } from '@/components/DateField'

// app/page.tsx tries claim_invite() before ever sending someone here, but
// this page is reachable directly too (a stale link, a refresh after an
// earlier failed match) — so it re-checks on its own rather than trusting
// that landing here means "definitely no space yet".
export default function OnboardingPage() {
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    (async () => {
      if (await getMySpace()) { router.replace('/'); return }
      const { data: claimed } = await createClient().rpc('claim_invite')
      if (claimed) { router.replace('/'); router.refresh(); return }
      setChecking(false)
    })()
  }, [router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget.elements
    const supabase = createClient()

    const { error } = await supabase.rpc('create_space', {
      p_title: (form.namedItem('title') as HTMLInputElement).value,
      p_anniversary: (form.namedItem('anniversary') as HTMLInputElement).value || null,
      p_display_name: (form.namedItem('name') as HTMLInputElement).value,
      p_timezone: browserTz,
      p_partner_email: (form.namedItem('partner') as HTMLInputElement).value || null,
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

  if (checking) {
    return <main style={{ background: 'var(--bg)', minHeight: '100vh' }} />
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="auth-wrap">
        <div className="auth-title">zerokm</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input name="name" className="input-bauhaus" placeholder="Your name" required autoFocus />
          <input name="title" className="input-bauhaus" placeholder="Space title (e.g. Our Distance)" />
          <DateField name="anniversary" label="When did you start dating? (optional)" />
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
      </div>
    </main>
  )
}
