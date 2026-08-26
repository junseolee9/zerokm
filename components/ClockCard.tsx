'use client'

import { useState, useEffect } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import type { Member } from '@/lib/types'

function getTimeStatus(hour: number): string {
  if (hour >= 5  && hour < 7)  return 'Dawn'
  if (hour >= 7  && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 17) return 'Afternoon'
  if (hour >= 17 && hour < 20) return 'Evening'
  if (hour >= 20 && hour < 23) return 'Night'
  return 'Late Night'
}

interface Props {
  member: Member
  timezone: string
}

export function ClockCard({ member, timezone }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  let hour = 0
  let timeStr = '--:--:--'
  let dateStr = '----'
  let ampm = 'AM'

  try {
    hour    = parseInt(formatInTimeZone(now, timezone, 'H'), 10)
    timeStr = formatInTimeZone(now, timezone, 'hh:mm:ss')
    dateStr = formatInTimeZone(now, timezone, 'yyyy . MM . dd   EEE')
    ampm    = formatInTimeZone(now, timezone, 'a')
  } catch {
    // invalid timezone — show placeholder
  }

  const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone
  const status   = getTimeStatus(hour)

  return (
    <div className="clock-card" style={{ '--pc': member.color } as React.CSSProperties}>
      <div className="card-topbar" />
      <div className={`clock-corner clock-corner-slot${member.slot}`} />
      <div className="clock-person">{member.display_name}</div>
      <div className="clock-tz">{cityName}</div>
      <div className="clock-ampm-text">{ampm} &nbsp;&middot;&nbsp; {status}</div>
      <div className="clock-time-wrap">
        <div className="clock-time">{timeStr}</div>
      </div>
      <div className="clock-date">{dateStr}</div>
    </div>
  )
}
