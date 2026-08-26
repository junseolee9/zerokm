'use client'

import { useState, useEffect } from 'react'
import { getTimezones } from '@/lib/timezones'

interface Props {
  name?: string
  value: string
  placeholder?: string
  // Fires on blur, only when what's typed is a real IANA zone — a
  // half-typed search string never becomes the live/saved timezone.
  onCommit?: (tz: string) => void
}

// <input list=...> + <datalist>: type to filter ~400 IANA zones instead of
// scrolling a <select>, no extra dependency for what the browser already
// does. Keeps its own draft text while focused, decoupled from `value`, so
// typing "Se" never briefly becomes the timezone clocks elsewhere render with.
export function TimezoneField({ name, value, placeholder, onCommit }: Props) {
  const [timezones, setTimezones] = useState<string[]>([])
  const [draft, setDraft] = useState(value)

  useEffect(() => { setTimezones(getTimezones()) }, [])
  useEffect(() => { setDraft(value) }, [value])

  const listId = `tz-options-${name ?? 'field'}`

  return (
    <>
      <input
        name={name}
        list={listId}
        className="input-bauhaus"
        placeholder={placeholder ?? 'Type to search, e.g. Seoul'}
        autoComplete="off"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (timezones.includes(draft)) {
            if (draft !== value) onCommit?.(draft)
          } else {
            setDraft(value) // invalid / abandoned search — snap back
          }
        }}
      />
      <datalist id={listId}>
        {timezones.map(tz => <option key={tz} value={tz} />)}
      </datalist>
    </>
  )
}
