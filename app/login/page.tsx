'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="auth-wrap">
        <div className="auth-title">zerokm</div>
        {sent ? (
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
            Check your inbox — we sent you a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              name="email"
              type="email"
              className="input-bauhaus"
              placeholder="your@email.com"
              autoFocus
              required
            />
            {error && (
              <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn-bauhaus-primary" disabled={loading}>
              {loading ? '...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
