'use client'

import { useState, useEffect } from 'react'
import { ClockCard } from './ClockCard'
import { TimeDiffBanner } from './TimeDiffBanner'
import { DistanceMap } from './DistanceMap'
import { updateMember } from '@/lib/queries'
import type { Member } from '@/lib/types'

// Populated after mount to avoid SSR/client hydration mismatch
let _tzCache: string[] | null = null
function getTimezones(): string[] {
  if (!_tzCache) _tzCache = Intl.supportedValuesOf('timeZone').sort()
  return _tzCache
}

interface Props {
  members: Member[]
  myUserId: string
}

export function ClocksSection({ members, myUserId }: Props) {
  // Live timezone per member; seeded from DB, updated optimistically.
  const [tzs, setTzs] = useState<Record<string, string>>(
    () => Object.fromEntries(members.map(m => [m.id, m.timezone]))
  )
  const [timezones, setTimezones] = useState<string[]>(
    () => Array.from(new Set(members.map(m => m.timezone))).sort()
  )

  useEffect(() => { setTimezones(getTimezones()) }, [])

  // Your own row, or the placeholder seat nobody has claimed yet.
  const canEdit = (m: Member) => m.user_id === myUserId || m.user_id === null

  async function changeTz(m: Member, tz: string) {
    setTzs(prev => ({ ...prev, [m.id]: tz }))
    try {
      await updateMember(m.id, { timezone: tz })
    } catch {
      setTzs(prev => ({ ...prev, [m.id]: m.timezone })) // revert on failure
    }
  }

  const [a, b] = members

  return (
    <>
      {/* Timezone selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
        {members.map(m => (
          <div key={m.id} style={{ '--pc': m.color } as React.CSSProperties}>
            <div className="person-label label-person">{m.display_name}</div>
            <select
              className="tz-select"
              value={tzs[m.id]}
              disabled={!canEdit(m)}
              title={canEdit(m) ? undefined : `Only ${m.display_name} can change this`}
              onChange={e => changeTz(m, e.target.value)}
            >
              {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        ))}
      </div>

      <hr className="bauhaus-rule" style={{ marginTop: 12 }} />

      {/* Clock cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 0 }}>
        {members.map(m => (
          <ClockCard key={m.id} member={m} timezone={tzs[m.id]} />
        ))}
      </div>

      {/* Time diff + distance */}
      <TimeDiffBanner
        aName={a.display_name} aTz={tzs[a.id]}
        bName={b.display_name} bTz={tzs[b.id]}
      />

      {/* Map */}
      <DistanceMap
        aTz={tzs[a.id]} aColor={a.color} aEmoji={a.emoji}
        bTz={tzs[b.id]} bColor={b.color} bEmoji={b.emoji}
      />
    </>
  )
}
