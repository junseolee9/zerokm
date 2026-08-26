'use client'

import { useState, useEffect } from 'react'
import { getTimezoneOffset } from 'date-fns-tz'
import tzCoords from '@/lib/tz-coords.json'
import { haversineKm } from '@/lib/haversine'

interface Props {
  aName: string
  aTz: string
  bName: string
  bTz: string
}

export function TimeDiffBanner({ aName, aTz, bName, bTz }: Props) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const now = new Date()
  const aOffset = getTimezoneOffset(aTz, now) / 3_600_000
  const bOffset = getTimezoneOffset(bTz, now) / 3_600_000
  const diffH = bOffset - aOffset
  const sign  = diffH >= 0 ? '+' : ''
  const ahead = diffH > 0 ? 'ahead' : 'behind'

  const coords = tzCoords as unknown as Record<string, [number, number]>
  const a = coords[aTz]
  const b = coords[bTz]
  const km = a && b ? haversineKm(a[0], a[1], b[0], b[1]) : null

  return (
    <>
      <div className="timediff-banner">
        <div className="timediff-inner">
          {aName} &nbsp;
          <span className="timediff-num">{sign}{diffH.toFixed(diffH % 1 ? 1 : 0)}h</span>
          &nbsp; {bName}
        </div>
        <div className="timediff-status">
          {bName} is {Math.abs(diffH).toFixed(Math.abs(diffH) % 1 ? 1 : 0)}h {ahead} of {aName}
        </div>
      </div>
      {km !== null && (
        <div className="distance-text">
          Distance between us: <b>{km.toLocaleString('en', { maximumFractionDigits: 0 })} km</b> — but <b>0 km</b> in our hearts
        </div>
      )}
    </>
  )
}
