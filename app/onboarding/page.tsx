'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'create' | 'join'

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>('create')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget.elements
    const name = (form.namedItem('name') as HTMLInputElement).value
    const supabase = createClient()

    const { error } = mode === 'create'
      ? await supabase.rpc('create_space', {
          p_title: (form.namedItem('title') as HTMLInputElement).value,
          p_anniversary: (form.namedItem('anniversary') as HTMLInputElement).value || null,
          p_display_name: name,
          p_timezone: browserTz,
        })
      : await supabase.rpc('join_space', {
          p_code: (form.namedItem('code') as HTMLInputElement).value,
          p_display_name: name,
          p_timezone: browserTz,
        })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="auth-wrap">
        <div className="auth-title">zerokm</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={mode === 'create' ? 'btn-bauhaus-primary' : 'btn-bauhaus'}
            onClick={() => { setMode('create'); setError('') }}
          >
            New space
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'btn-bauhaus-primary' : 'btn-bauhaus'}
            onClick={() => { setMode('join'); setError('') }}
          >
            I have a code
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input name="name" className="input-bauhaus" placeholder="Your name" required />
          {mode === 'create' ? (
            <>
              <input name="title" className="input-bauhaus" placeholder="Space title (e.g. Our Distance)" />
              <input name="anniversary" type="date" className="input-bauhaus" title="Anniversary (optional)" />
            </>
          ) : (
            <input name="code" className="input-bauhaus" placeholder="Invite code" required />
          )}
          {error && (
            <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn-bauhaus-primary" disabled={loading}>
            {loading ? '...' : mode === 'create' ? 'Create' : 'Join'}
          </button>
        </form>
      </div>
    </main>
  )
}
