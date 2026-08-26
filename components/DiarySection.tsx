'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CalendarGrid } from './CalendarGrid'
import { DiaryEntry } from './DiaryEntry'
import { getEntries } from '@/lib/queries'
import type { Space, Member, EntryMap } from '@/lib/types'

interface Props {
  space: Space
  members: Member[]
}

export function DiarySection({ space, members }: Props) {
  const searchParams = useSearchParams()
  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const initDate  = searchParams.get('date')
  const initYear  = searchParams.get('year')
  const initMonth = searchParams.get('month')

  const [year,    setYear]    = useState(initYear  ? parseInt(initYear)  : today.getFullYear())
  const [month,   setMonth]   = useState(initMonth ? parseInt(initMonth) : today.getMonth() + 1)
  const [selDate, setSelDate] = useState(initDate  ?? todayStr)
  const [entries, setEntries] = useState<EntryMap>({})
  const [loading, setLoading] = useState(true)

  const router   = useRouter()
  const pathname = usePathname()

  const fetchEntries = useCallback(async () => {
    try {
      setEntries(await getEntries(space.id))
    } finally {
      setLoading(false)
    }
  }, [space.id])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) params.set(k, v)
    router.replace(`${pathname}?${params.toString()}#diary-anchor`, { scroll: false })
  }

  function selectDate(date: string) {
    setSelDate(date)
    updateParams({ date })
  }

  function prevMonth() {
    const [y, m] = month === 1 ? [year - 1, 12] : [year, month - 1]
    setYear(y); setMonth(m)
    updateParams({ year: String(y), month: String(m).padStart(2, '0') })
  }

  function nextMonth() {
    const [y, m] = month === 12 ? [year + 1, 1] : [year, month + 1]
    setYear(y); setMonth(m)
    updateParams({ year: String(y), month: String(m).padStart(2, '0') })
  }

  const selDt    = new Date(selDate + 'T12:00:00')
  const selLabel = `${selDt.getFullYear()} . ${String(selDt.getMonth() + 1).padStart(2, '0')} . ${String(selDt.getDate()).padStart(2, '0')}`

  function patchEntry(date: string, memberId: string, patch: { text?: string; photo_url?: string | null }) {
    setEntries(prev => {
      const day = prev[date] ?? {}
      const cur = day[memberId] ?? { date, member_id: memberId, text: '', photo_path: null }
      return {
        ...prev,
        [date]: {
          ...day,
          [memberId]: {
            ...cur,
            ...(patch.text !== undefined ? { text: patch.text } : {}),
            ...(patch.photo_url !== undefined
              ? { photo_url: patch.photo_url ?? undefined, photo_path: patch.photo_url ? cur.photo_path ?? 'pending' : null }
              : {}),
          },
        },
      }
    })
  }

  return (
    <div id="diary-anchor">
      <div className="diary-main-header">Our Diary</div>

      {/* Calendar navigation */}
      <div className="cal-nav-row">
        <button className="btn-bauhaus" onClick={prevMonth} style={{ padding: '8px 16px', fontSize: 16 }}>◀</button>
        <div className="cal-nav-title">
          {year} &nbsp;·&nbsp; {String(month).padStart(2, '0')}
        </div>
        <button className="btn-bauhaus" onClick={nextMonth} style={{ padding: '8px 16px', fontSize: 16 }}>▶</button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div style={{ height: 200, background: '#F8F8F8', border: '3px solid #121212' }} />
      ) : (
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selDate}
          entries={entries}
          members={members}
          onDateSelect={selectDate}
        />
      )}

      {/* Selected date diary */}
      <div className="diary-sel-date">{selLabel}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {members.map(m => {
          const entry = entries[selDate]?.[m.id]
          return (
            <DiaryEntry
              key={`${m.id}-${selDate}`}
              spaceId={space.id}
              date={selDate}
              member={m}
              text={entry?.text ?? ''}
              photoUrl={entry?.photo_url ?? null}
              onTextChanged={t => patchEntry(selDate, m.id, { text: t })}
              onPhotoChanged={url => patchEntry(selDate, m.id, { photo_url: url })}
            />
          )
        })}
      </div>
    </div>
  )
}
