'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DateField } from '@/components/DateField'

// Reaching this page means claim_invite() found no seat reserved for this
// Google account (app/page.tsx tries the claim first), so the only path
// left is starting a new space and inviting your partner.
export default function OnboardingPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone

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
