'use client'

import { useState } from 'react'
import { ClockCard } from './ClockCard'
import { TimeDiffBanner } from './TimeDiffBanner'
import { DistanceMap } from './DistanceMap'
import { TimezoneField } from './TimezoneField'
import { updateMember } from '@/lib/queries'
import type { Member } from '@/lib/types'

interface Props {
  members: Member[]
  myUserId: string
}

export function ClocksSection({ members, myUserId }: Props) {
  // Live timezone per member; seeded from DB, updated optimistically.
  const [tzs, setTzs] = useState<Record<string, string>>(
    () => Object.fromEntries(members.map(m => [m.id, m.timezone]))
  )

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
            {canEdit(m) ? (
              <TimezoneField value={tzs[m.id]} onCommit={tz => changeTz(m, tz)} />
            ) : (
              <input className="input-bauhaus" value={tzs[m.id]} disabled title={`Only ${m.display_name} can change this`} readOnly />
            )}
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
